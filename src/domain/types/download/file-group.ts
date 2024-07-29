
// ダウンロードするCSVのファイル名のルール
export type FileGroupKey = 'pref' | 'pref_pos' | 'city' | 'city_pos' | 'town' | 'rsdtdsp_blk' | 'rsdtdsp_rsdt' | 'town_pos' | 'rsdtdsp_blk_pos' | 'rsdtdsp_rsdt_pos' | 'parcel' | 'parcel_pos';

export type FileGroup2Key = 'all' | 'pref' | 'city';

const FileGroupKeys = new Set([
  'pref', 'pref_pos', 'city', 'city_pos', 'town', 'rsdtdsp_blk', 'rsdtdsp_rsdt', 'town_pos', 'rsdtdsp_blk_pos', 'rsdtdsp_rsdt_pos', 'parcel', 'parcel_pos'
])

export const isFileGroupKey = (target: string): target is FileGroupKey => {
  return FileGroupKeys.has(target);
}