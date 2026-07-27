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

	// If searchAddr contains chome notation (e.g., "舞浜2@:11"), adjust machiaza_id
	// The base machiaza_id might be for the town without chome (e.g., "0043000" for 舞浜)
	// We need to use the chome-specific machiaza_id (e.g., "0043002" for 舞浜2丁目)
	if parsed.HasChome && parsed.Chome != "" {
		adjusted := adjustMachiazaIDForChome(machiazaID, parsed.Chome)
		// This runs on every chome-bearing residential search; keep the
		// disabled-logging cost to the level check alone.
		if adjusted != machiazaID && debugEnabled(ctx) {
			debugMatchPath(ctx, "chome_machiaza_adjust", parsed.Base,
				"machiaza_id", machiazaID, "adjusted", adjusted)
		}
		machiazaID = adjusted
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

	// For parcel_count == 0, try base machiaza_id (last 3 digits = "000")
	// This handles Kyoto street names and koaza addresses where parcel data
	// is stored under the base machiaza_id instead of the detailed one
	// e.g., 0098104 (寺町通御池上る上本能寺前町) -> try 0098000 (上本能寺前町)
	// e.g., 0231136 (大字南長野県町) -> try 0231000 (大字南長野)
	if parcelCount == 0 && !model.IsBaseMachiazaID(machiazaID) {
		baseMachiazaID := machiazaID[:model.MachiazaBaseLength] + model.BaseMachiazaSuffix
		pr, err := s.repo.FindParcelExact(ctx, lgCode, baseMachiazaID, filter)
		if err != nil {
			return nil, fmt.Errorf("parcel search (base machiaza): %w", err)
		}
		if pr != nil {
			result := repository.ParcelResultToNormalized(pr)
			// Keep original machiaza_id (e.g., 0231136 for 県町) instead of base (0231000)
			result.IDs.MachiazaID = &machiazaID
			return &result, nil
		}
	}

	return nil, nil
}

// normalizeWithBasic performs normalization when basicResults are already available.
func (s *twoStageSearch) normalizeWithBasic(
	ctx context.Context,
	category model.Category,
	basicResults []model.MatchedResult,
	searchAddr string,
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

	parsed := parseSearchAddr(searchAddr)
	var result *model.MatchedResult
	var err error
	switch category {
	case model.CategoryResidential:
		result, err = s.searchResidential(ctx, lgCode, machiazaID, parsed)
	case model.CategoryParcel:
		result, err = s.searchParcel(ctx, lgCode, machiazaID, parsed, basic.IDs.ParcelCount)
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
