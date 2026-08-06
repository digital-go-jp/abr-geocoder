package matching

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"abrg/internal/char"
	"abrg/internal/model"
	"abrg/internal/repository"
	"abrg/internal/util"
)

// residentialParcelQuerier is a consumer-defined interface for residential and parcel lookups.
type residentialParcelQuerier interface {
	FindResidentialBestMatch(ctx context.Context, lgCode, machiazaID string, filter repository.ResidentialFilter) (*repository.ResidentialBestResult, error)
	FindParcelExact(ctx context.Context, lgCode, machiazaID string, filter repository.ParcelFilter) (*repository.ParcelResult, error)
}

// twoStageSearch performs 2-stage address normalization.
// Step 1: Use already-detected machiaza (from basicResults).
// Step 2: Search for specific address numbers (blk_num/rsdt_num or prc_num).
type twoStageSearch struct {
	repo residentialParcelQuerier
}

// newTwoStageSearch creates a new twoStageSearch instance.
func newTwoStageSearch(repo residentialParcelQuerier) *twoStageSearch {
	return &twoStageSearch{repo: repo}
}

// adjustMachiazaIDForChome adjusts machiaza_id to include chome number.
//
//	e.g., machiaza_id="0043000", chomeNum="2" -> "0043002"
func adjustMachiazaIDForChome(machiazaID, chomeNum string) string {
	if len(machiazaID) != model.MachiazaIDLength || chomeNum == "" {
		return machiazaID
	}

	// Extract only digit characters from chomeNum
	var digits []byte
	for _, r := range chomeNum {
		if char.IsASCIIDigit(r) {
			digits = append(digits, byte(r))
		}
	}
	if len(digits) == 0 {
		return machiazaID
	}

	chome, err := strconv.Atoi(string(digits))
	if err != nil || chome <= 0 || chome > model.MaxChomeNumber {
		return machiazaID
	}

	return machiazaID[:model.MachiazaBaseLength] + fmt.Sprintf("%03d", chome)
}

// searchResidential searches for residential address using 2-stage approach.
func (s *twoStageSearch) searchResidential(ctx context.Context, lgCode, machiazaID string, parsed parsedAddress) (*model.MatchedResult, error) {
	numbers := parsed.Numbers
	if len(numbers) == 0 {
		return nil, nil
	}

	blkNum := numbers[0]
	var rsdtNum, rsdtNum2 string
	if len(numbers) > 1 {
		rsdtNum = numbers[1]
	}
	if len(numbers) > 2 {
		rsdtNum2 = numbers[2]
	}

	// If searchAddr carries chome notation (e.g. "舞浜2@:11"), the machiaza_id
	// in hand may be the town without chome; the chome-specific one carries the
	// chome number in its last three digits.
	if parsed.HasChome && parsed.Chome != "" {
		adjusted := adjustMachiazaIDForChome(machiazaID, parsed.Chome)
		if adjusted != machiazaID {
			debugMatchPath(ctx, "chome_machiaza_adjust", parsed.Base,
				"machiaza_id", machiazaID, "adjusted", adjusted)
			machiazaID = adjusted
		}
	}

	// Single query to find the best residential match across all specificity levels.
	best, err := s.repo.FindResidentialBestMatch(ctx, lgCode, machiazaID, repository.ResidentialFilter{
		BlkNum: blkNum, RsdtNum: rsdtNum, RsdtNum2: rsdtNum2,
	})
	if err != nil {
		return nil, fmt.Errorf("residential search: %w", err)
	}
	if best == nil {
		return nil, nil
	}

	result := repository.ResidentialResultToNormalized(&best.ResidentialResult)

	// Compute unmatched address based on match level
	switch best.MatchLevel {
	case repository.MatchLevelBlk:
		if rsdtNum != "" {
			unmatched := "-" + rsdtNum
			if rsdtNum2 != "" {
				unmatched += "-" + rsdtNum2
			}
			result.UnmatchedAddress = []string{unmatched}
		}
	case repository.MatchLevelRsdt:
		if rsdtNum2 != "" {
			result.UnmatchedAddress = []string{"-" + rsdtNum2}
		}
	case repository.MatchLevelRsdt2:
		// Full match - no unmatched address
	}

	return &result, nil
}

// parcelPrefixFor returns the prefix to try in front of the parcel number: the
// character the address writes between the town name and the digits, unless the
// town it matched already ends with it (字五軒丁 in 字五軒丁15-1), where the
// character is part of the name and the number stands alone.
func parcelPrefixFor(parsed parsedAddress, basic *model.MatchedResult) string {
	prefix := parsed.parcelNumberPrefix()
	if prefix == "" || strings.HasSuffix(basic.MatchedAddress, prefix) {
		return ""
	}
	return prefix
}

// canUseBaseMachiaza reports whether the parcels of the base machiaza can answer
// for machiazaID. Only a Kyoto street name qualifies: it is another way of
// writing the same town, and ABR files the parcels under the town. A koaza is a
// separate area inside the town, so the town's parcels are not its own.
// kyoto_st is set exactly on the rows ABR marks koaza_aka_code = 2.
func canUseBaseMachiaza(machiazaID string, basic *model.MatchedResult) bool {
	return basic.StructuredAddress.KyotoSt != nil && !model.IsBaseMachiazaID(machiazaID)
}

// searchParcel searches for parcel address using exact prc_num matching.
func (s *twoStageSearch) searchParcel(ctx context.Context, lgCode, machiazaID string, parsed parsedAddress, basic *model.MatchedResult) (*model.MatchedResult, error) {
	numbers := parsed.numericParts()
	if len(numbers) == 0 {
		return nil, nil
	}
	parcelCount := basic.Machiaza.ParcelCount
	useBase := parcelCount == 0 && canUseBaseMachiaza(machiazaID, basic)
	// With no parcels here and no base machiaza to stand in, neither lookup
	// below runs, so stop before building the search terms.
	if parcelCount == 0 && !useBase {
		return nil, nil
	}
	prcPrefix := parcelPrefixFor(parsed, basic)

	prcNum1 := numbers[0]
	var prcNum2, prcNum3 string
	if len(numbers) > 1 {
		prcNum2 = numbers[1]
	}
	if len(numbers) > 2 {
		prcNum3 = numbers[2]
	}

	// The prefixed form is tried first: a town can hold both 402 and 甲402, and
	// an address that spells the prefix means the latter.
	var num1Forms []string
	if prcPrefix != "" {
		for _, spelling := range util.KanaSpellings(prcPrefix) {
			num1Forms = append(num1Forms, spelling+prcNum1)
		}
	}
	num1Forms = append(num1Forms, prcNum1)
	// A branch number is looked up in every kana ABR records it in, since the
	// search address holds only one of them.
	num2Forms, num3Forms := util.KanaSpellings(prcNum2), util.KanaSpellings(prcNum3)
	find := func(mID string) (*repository.ParcelResult, error) {
		for _, num1 := range num1Forms {
			for _, num2 := range num2Forms {
				for _, num3 := range num3Forms {
					pr, err := s.repo.FindParcelExact(ctx, lgCode, mID, repository.ParcelFilter{
						PrcNum1: num1, PrcNum2: num2, PrcNum3: num3,
					})
					if err != nil || pr != nil {
						return pr, err
					}
				}
			}
		}
		return nil, nil
	}

	// Only search if parcel_count > 0 (this machiaza_id has parcel data)
	if parcelCount > 0 {
		pr, err := find(machiazaID)
		if err != nil {
			return nil, fmt.Errorf("parcel search: %w", err)
		}
		if pr != nil {
			result := repository.ParcelResultToNormalized(pr)
			return &result, nil
		}
	}

	// With no parcel rows under this machiaza, retry under the base machiaza
	// (last 3 digits "000"), where a Kyoto street name keeps its parcel data.
	if useBase {
		pr, err := find(machiazaID[:model.MachiazaBaseLength] + model.BaseMachiazaSuffix)
		if err != nil {
			return nil, fmt.Errorf("parcel search (base machiaza): %w", err)
		}
		if pr != nil {
			result := repository.ParcelResultToNormalized(pr)
			// Report the detailed machiaza the address matched, not the base
			// one the parcel row was found under.
			result.IDs.MachiazaID = &machiazaID
			return &result, nil
		}
	}

	return nil, nil
}

// machiazaKey returns the lg_code and machiaza_id a two-stage search keys on.
// ok is false when either is absent, which leaves nothing to search under.
func machiazaKey(basic *model.MatchedResult) (lgCode, machiazaID string, ok bool) {
	if basic.IDs.LgCode == nil || basic.IDs.MachiazaID == nil {
		return "", "", false
	}
	lgCode, machiazaID = *basic.IDs.LgCode, *basic.IDs.MachiazaID
	if lgCode == "" || machiazaID == "" {
		return "", "", false
	}
	return lgCode, machiazaID, true
}

// applyRsdtAddrFlg fills in rsdt_addr_flg, which is not in cache_parcel or
// cache_rsdtdsp. A residential match is by definition in the 住居表示実施 part of
// the machiaza, so the flag is always 1; inheriting it from basicResults would
// report the base machiaza's flag, which in mixed rsdtdsp/parcel areas is 0 or
// ambiguous (one row per flag) (issue #262).
func applyRsdtAddrFlg(result, basic *model.MatchedResult, category model.Category) {
	if result.IDs.RsdtAddrFlg != nil {
		return
	}
	if category == model.CategoryResidential {
		flg := model.RsdtAddrFlgResidential
		result.IDs.RsdtAddrFlg = &flg
		return
	}
	if basic.IDs.RsdtAddrFlg != nil {
		result.IDs.RsdtAddrFlg = basic.IDs.RsdtAddrFlg
	}
}

// normalizeWithBasic performs normalization when basicResults are already available.
// The search address arrives parsed: match_core parses the input once and that
// value is threaded down to searchResidential and searchParcel.
func (s *twoStageSearch) normalizeWithBasic(
	ctx context.Context,
	category model.Category,
	basicResults []model.MatchedResult,
	parsed parsedAddress,
) ([]model.MatchedResult, error) {
	if len(basicResults) == 0 {
		return nil, nil
	}

	basic := &basicResults[0]
	lgCode, machiazaID, ok := machiazaKey(basic)
	if !ok {
		return nil, nil
	}

	var result *model.MatchedResult
	var err error
	switch category {
	case model.CategoryResidential:
		result, err = s.searchResidential(ctx, lgCode, machiazaID, parsed)
	case model.CategoryParcel:
		result, err = s.searchParcel(ctx, lgCode, machiazaID, parsed, basic)
	default:
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	if result == nil {
		return nil, nil
	}

	applyRsdtAddrFlg(result, basic, category)

	// Merge basic address info from basicResults (avoids redundant DB queries)
	result.StructuredAddress.MergeFrom(&basic.StructuredAddress)

	// For residential search, extract chome from searchAddr if present (e.g., "舞浜2@:11" -> "2丁目")
	if category == model.CategoryResidential && result.StructuredAddress.Chome == nil {
		if parsed.HasChome && parsed.Chome != "" {
			chome := parsed.Chome + "丁目"
			result.StructuredAddress.Chome = &chome
		}
	}

	// Rebuild matched address with full info
	result.MatchedAddress = model.FormatAddress(&result.StructuredAddress)

	return []model.MatchedResult{*result}, nil
}
