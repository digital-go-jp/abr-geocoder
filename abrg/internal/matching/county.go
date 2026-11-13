package matching

import "strings"

// insertCounty puts the county back into an address that writes a town or
// village right after the prefecture without it, so that "宮城県涌谷町" is
// matched as "宮城県遠田郡涌谷町".
// Without the county the name reaches no city, or a city of a similar name
// (釧路町 as 釧路市).
func (n *Impl) insertCounty(addr string) string {
	for pref, cities := range n.countyCities {
		rest, ok := strings.CutPrefix(addr, pref)
		if !ok {
			continue
		}
		// The longest name wins, so that the outcome never depends on map order.
		var county, city string
		for c, co := range cities {
			if len(c) > len(city) && strings.HasPrefix(rest, c) {
				county, city = co, c
			}
		}
		if county == "" {
			return addr
		}
		return pref + county + rest
	}
	return addr
}
