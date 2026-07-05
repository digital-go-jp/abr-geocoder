package duckdb

import (
	"fmt"
	"slices"
	"strings"

	"abrdb/internal/schema"
)

// columnSpec represents a SELECT expression and its alias.
type columnSpec struct {
	expr  string
	alias string
}

func (c columnSpec) sql() string {
	return fmt.Sprintf("%s as %s", c.expr, c.alias)
}

// categoryTransformer handles category-specific SQL transformations
type categoryTransformer struct {
	categoryInfo *schema.CategoryInfo
}

// alias adds table alias "t." when joining position table is enabled
func alias(hasPos bool, c string) string {
	if hasPos {
		return "t." + c
	}
	return c
}

// newTransformer creates a transformer for the given category info.
func newTransformer(categoryInfo *schema.CategoryInfo) *categoryTransformer {
	return &categoryTransformer{categoryInfo: categoryInfo}
}

func (t *categoryTransformer) buildTransformSQL(hasPos bool, tn tableNames) string {
	specs := slices.Concat(
		t.selectBaseColumns(hasPos),
		t.selectPositionColumns(hasPos),
		[]columnSpec{
			{expr: t.joinSeqExpr(hasPos), alias: "join_seq"},
		},
	)

	cols := make([]string, len(specs))
	for i, spec := range specs {
		cols[i] = spec.sql()
	}

	from := t.fromClause(hasPos, tn)

	return fmt.Sprintf(
		"CREATE OR REPLACE TEMP TABLE %s AS\nSELECT %s\n%s\n",
		tn.Transformed, strings.Join(cols, ", "), from,
	)
}

func (t *categoryTransformer) selectBaseColumns(hasPos bool) []columnSpec {
	specs := make([]columnSpec, len(t.categoryInfo.TextColumns))
	for i, c := range t.categoryInfo.TextColumns {
		src := alias(hasPos, c)
		if t.categoryInfo.FullwidthColumns[c] {
			src = convertFullWidthNumbers(src)
		}
		specs[i] = columnSpec{expr: src, alias: c}
	}
	return specs
}

func (t *categoryTransformer) selectPositionColumns(hasPos bool) []columnSpec {
	textColSet := make(map[string]struct{}, len(t.categoryInfo.TextColumns))
	for _, c := range t.categoryInfo.TextColumns {
		textColSet[c] = struct{}{}
	}

	// Collect unique pos columns (not in text columns)
	var specs []columnSpec
	for _, c := range t.categoryInfo.PosColumns {
		if _, exists := textColSet[c]; exists {
			continue
		}
		expr := "NULL"
		if hasPos {
			expr = "p." + c
		}
		specs = append(specs, columnSpec{expr: expr, alias: c})
	}
	return specs
}

// joinSeqExpr returns ROW_NUMBER expression when joining, otherwise constant 1
// Performance optimization: Use direct column references (no COALESCE) for PARTITION BY,
// and simplified ORDER BY (constant 1) since we only need to deduplicate, not order.
func (t *categoryTransformer) joinSeqExpr(hasPos bool) string {
	if hasPos && len(t.categoryInfo.JoinColumns) > 0 {
		// Direct column references for PARTITION BY (NULL values group together naturally)
		partitionCols := make([]string, len(t.categoryInfo.JoinColumns))
		for i, col := range t.categoryInfo.JoinColumns {
			partitionCols[i] = "t." + col
		}
		return fmt.Sprintf("ROW_NUMBER() OVER (PARTITION BY %s ORDER BY 1)", strings.Join(partitionCols, ", "))
	}
	return "1"
}

// fromClause builds the FROM (and optional LEFT JOIN) clause
func (t *categoryTransformer) fromClause(hasPos bool, tn tableNames) string {
	// JOIN only when there are join columns and position data is present
	if hasPos && len(t.categoryInfo.JoinColumns) > 0 {
		return fmt.Sprintf("FROM %s t LEFT JOIN %s p%s", tn.Text, tn.Pos, t.buildJoinCondition())
	}
	return "FROM " + tn.Text
}

func (t *categoryTransformer) buildJoinCondition() string {
	var conditions []string
	for _, col := range t.categoryInfo.JoinColumns {
		// Use IS NOT DISTINCT FROM for NULL-safe comparison (more efficient than COALESCE)
		conditions = append(conditions, fmt.Sprintf("t.%s IS NOT DISTINCT FROM p.%s", col, col))
	}
	if len(conditions) == 0 {
		return ""
	}
	return " ON " + strings.Join(conditions, " AND ")
}

func convertFullWidthNumbers(col string) string {
	return fmt.Sprintf(
		"translate(%s, '%s', '%s')",
		col,
		escapeSQLLiteral(fullWidthCharSet),
		escapeSQLLiteral(halfWidthCharSet),
	)
}

const (
	fullWidthCharSet = "０１２３４５６７８９ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ！＂＃＄％＆＇（）＊＋，－．／：；＜＝＞？＠［＼］＾＿｀｛｜｝～"
	halfWidthCharSet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~"
)

// escapeSQLLiteral escapes quotes and backslashes for embedding into SQL string literals.
func escapeSQLLiteral(s string) string {
	escaped := strings.ReplaceAll(s, "\\", "\\\\")
	return strings.ReplaceAll(escaped, "'", "''")
}
