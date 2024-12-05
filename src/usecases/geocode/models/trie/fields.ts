// const fieldMapping = {
//   pref: "a",
//   city: "b",
//   oaza_cho: "c",
//   rsdt_addr_flg: "d",
//   prc1: "e",
//   prc2: "f",
//   prc3: "g",
//   block_id: "h",
//   block_id2: "i",
// };

export type PropertiesMap = {
  [key: string]: string;
};

// データを短縮フィールド名に変換する関数
export const convertToShortFields = (data: { [key: string]: unknown }, mapping: PropertiesMap) => {
  const convertedData: { [key: string]: unknown } = {};
  for (const [key, value] of Object.entries(data)) {
    const shortKey = mapping[key] || key; // マッピングがない場合は元のキーを使う
    convertedData[shortKey] = value;
  }
  return convertedData;
};

// 短縮フィールド名から元のフィールド名に戻す関数
export const convertToOriginalFields = (data: { [key: string]: unknown }, mapping: PropertiesMap) => {
  const convertedData: { [key: string]: unknown } = {};
  for (const [key, value] of Object.entries(data)) {
    const originalKey = mapping[key] || key; // マッピングがない場合はそのまま
    convertedData[originalKey] = value;
  }
  return convertedData;
};

// 逆マッピングを作成して、読み出し時に復元可能にする
export const reverseFieldMapping = (fieldMapping: { [key: string]: [hashValue: number] }, mapping: PropertiesMap) => {
  Object.fromEntries(
    Object.entries(fieldMapping).map(([key, value]) => [value, key]),
  );
};

