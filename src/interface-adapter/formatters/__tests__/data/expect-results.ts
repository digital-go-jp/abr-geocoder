import { MatchLevel } from "@domain/match-level";
import { PrefectureName } from "@domain/prefecture-name";

export type expectResult = {
  query: {
    input: string;
  },
  result: {
    output: string;
    prefecture: PrefectureName;
    match_level: MatchLevel;
    city: string;
    town: string;
    town_id: string;
    lg_code: string;
    other: string;
    lat: number;
    lon: number;
    block: string;
    block_id: string;
    addr1: string;
    addr1_id: string;
    addr2: string;
    addr2_id: string;
  }
};
export const expectResults: expectResult[] = [
  {
    "query": {
      "input": "東京都千代田区紀尾井町1-3　東京ガーデンテラス紀尾井町 19階、20階"
    },
    "result": {
      "output": "東京都千代田区紀尾井町1-3 東京ガーデンテラス紀尾井町 19階、20階",
      "prefecture": PrefectureName.TOKYO,
      "match_level": MatchLevel.RESIDENTIAL_DETAIL,
      "city": "千代田区",
      "town": "紀尾井町",
      "town_id": "0056000",
      "lg_code": "131016",
      "other": " 東京ガーデンテラス紀尾井町 19階、20階",
      "lat": 35.681411,
      "lon": 139.73495,
      "block": "1",
      "block_id": "001",
      "addr1": "3",
      "addr1_id": "003",
      "addr2": "",
      "addr2_id": ""
    }
  },
  {
    "query": {
      "input": '東京都千代田区紀尾井町1-3　"19階、20階"'
    },
    "result": {
      "output": '東京都千代田区紀尾井町1-3 "19階、20階"',
      "prefecture": PrefectureName.TOKYO,
      "match_level": MatchLevel.RESIDENTIAL_DETAIL,
      "city": "千代田区",
      "town": "紀尾井町",
      "town_id": "0056000",
      "lg_code": "131016",
      "other": ' "19階、20階"',
      "lat": 35.681411,
      "lon": 139.73495,
      "block": "1",
      "block_id": "001",
      "addr1": "3",
      "addr1_id": "003",
      "addr2": "",
      "addr2_id": ""
    }
  },
  {
    "query": {
      "input": '東京都千代田区紀尾井町1-3　19,20階'
    },
    "result": {
      "output": '東京都千代田区紀尾井町1-3 19,20階',
      "prefecture": PrefectureName.TOKYO,
      "match_level": MatchLevel.RESIDENTIAL_DETAIL,
      "city": "千代田区",
      "town": "紀尾井町",
      "town_id": "0056000",
      "lg_code": "131016",
      "other": ' 19,20階',
      "lat": 35.681411,
      "lon": 139.73495,
      "block": "1",
      "block_id": "001",
      "addr1": "3",
      "addr1_id": "003",
      "addr2": "",
      "addr2_id": ""
    }
  },
  {
    "query": {
      "input": "東京都千代田区紀尾井町1"
    },
    "result": {
      "output": "東京都千代田区紀尾井町1",
      "prefecture": PrefectureName.TOKYO,
      "match_level": MatchLevel.RESIDENTIAL_BLOCK,
      "city": "千代田区",
      "town": "紀尾井町",
      "town_id": "0056000",
      "lg_code": "131016",
      "other": "",
      "lat": 35.681411,
      "lon": 139.73495,
      "block": "1",
      "block_id": "001",
      "addr1": "",
      "addr1_id": "",
      "addr2": "",
      "addr2_id": ""
    }
  },
  {
    "query": {
      "input": "山形県山形市旅篭町二丁目3番25号"
    },
    "result": {
      "output": "山形県山形市旅篭町二丁目3-25",
      "prefecture": PrefectureName.YAMAGATA,
      "match_level": MatchLevel.RESIDENTIAL_DETAIL,
      "city": "山形市",
      "town": "旅篭町二丁目",
      "town_id": "0247002",
      "lg_code": "062014",
      "other": "",
      "lat": 38.255437,
      "lon": 140.339126,
      "block": "3",
      "block_id": "003",
      "addr1": "25",
      "addr1_id": "025",
      "addr2": "",
      "addr2_id": ""
    }
  },
  {
    "query": {
      "input": "山形市旅篭町二丁目3番25号"
    },
    "result": {
      "output": "山形県山形市旅篭町二丁目3-25",
      "prefecture": PrefectureName.YAMAGATA,
      "match_level": MatchLevel.RESIDENTIAL_DETAIL,
      "city": "山形市",
      "town": "旅篭町二丁目",
      "town_id": "0247002",
      "lg_code": "062014",
      "other": "",
      "lat": 38.255437,
      "lon": 140.339126,
      "block": "3",
      "block_id": "003",
      "addr1": "25",
      "addr1_id": "025",
      "addr2": "",
      "addr2_id": ""
    }
  },
  {
    "query": {
      "input": "東京都町田市森野2-2-22 町田市役所"
    },
    "result": {
      "output": "東京都町田市森野二丁目2-22 町田市役所",
      "prefecture": PrefectureName.TOKYO,
      "match_level": MatchLevel.RESIDENTIAL_DETAIL,
      "city": "町田市",
      "town": "森野二丁目",
      "town_id": "0006002",
      "lg_code": "132098",
      "other": "町田市役所",
      "lat": 35.548247,
      "lon": 139.440264,
      "block": "2",
      "block_id": "002",
      "addr1": "22",
      "addr1_id": "022",
      "addr2": "",
      "addr2_id": ""
    }
  }
];