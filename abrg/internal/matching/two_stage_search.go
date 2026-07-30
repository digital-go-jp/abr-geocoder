package matching

import (
	"context"
	"fmt"
	"strconv"

	"abrg/internal/char"
	"abrg/internal/model"
	"abrg/internal/repository"
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

// searchParcel searches for parcel address using exact prc_num matching.
func (s *twoStageSearch) searchParcel(ctx context.Context, lgCode, machiazaID string, parsed parsedAddress, parcelCount int) (*model.MatchedResult, error) {
	numbers := parsed.numericParts()
	if len(numbers) == 0 {
		return nil, nil
	}

	prcNum1 := numbers[0]
	var prcNum2, prcNum3 string
	if len(numbers) > 1 {
		prcNum2 = numbers[1]
	}
	if len(numbers) > 2 {
		prcNum3 = numbers[2]
	}

	filter := repository.ParcelFilter{PrcNum1: prcNum1, PrcNum2: prcNum2, PrcNum3: prcNum3}

	// Only search if parcel_count > 0 (this machiaza_id has parcel data)
	if parcelCount > 0 {
		pr, err := s.repo.FindParcelExact(ctx, lgCode, machiazaID, filter)
		if err != nil {
			return nil, fmt.Errorf("parcel search: %w", err)
		}
		if pr != nil {
			result := repository.ParcelResultToNormalized(pr)
			return &result, nil
		}
	}

	// With no parcel rows under this machiaza, retry under the base machiaza
	// (last 3 digits "000"). Kyoto street names and koaza addresses keep their
	// parcel data there rather than under the detailed machiaza.
	if parcelCount == 0 && !model.IsBaseMachiazaID(machiazaID) {
		baseMachiazaID := machiazaID[:model.MachiazaBaseLength] + model.BaseMachiazaSuffix
		pr, err := s.repo.FindParcelExact(ctx, lgCode, baseMachiazaID, filter)
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
	if basic.IDs.LgCode == nil || basic.IDs.MachiazaID == nil {
		return nil, nil
	}

	lgCode := *basic.IDs.LgCode
	machiazaID := *basic.IDs.MachiazaID
	if lgCode == "" || machiazaID == "" {
		return nil, nil
	}

	var result *model.MatchedResult
	var err error
	switch category {
	case model.CategoryResidential:
		result, err = s.searchResidential(ctx, lgCode, machiazaID, parsed)
	case model.CategoryParcel:
		result, err = s.searchParcel(ctx, lgCode, machiazaID, parsed, basic.Machiaza.ParcelCount)
	default:
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	if result == nil {
		return nil, nil
	}

	// rsdt_addr_flg is not in cache_parcel or cache_rsdtdsp. A residential match is
	// by definition in the 住居表示実施 part of the machiaza, so the flag is always 1;
	// inheriting it from basicResults would report the base machiaza's flag, which in
	// mixed rsdtdsp/parcel areas is 0 or ambiguous (one row per flag) (issue #262).
	if result.IDs.RsdtAddrFlg == nil {
		if category == model.CategoryResidential {
			flg := model.RsdtAddrFlgResidential
			result.IDs.RsdtAddrFlg = &flg
		} else if basic.IDs.RsdtAddrFlg != nil {
			result.IDs.RsdtAddrFlg = basic.IDs.RsdtAddrFlg
		}
	}

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
