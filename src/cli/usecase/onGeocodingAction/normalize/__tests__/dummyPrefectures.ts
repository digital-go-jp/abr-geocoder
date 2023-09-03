import { IPrefecture, PrefectureName } from "../../types";

export const dummyPrefectures : IPrefecture[] = [
  {
    name: '越後県' as PrefectureName,
    cities: [
      {
        lg_code: '001-1',
        name: '越後市'
      },
      {
        lg_code: '001-2',
        name: '陸奥市'
      },
      {
        lg_code: '001-3',
        name: '弥彦村'
      },
    ],
  },
  {
    name: '陸奥県' as PrefectureName,
    cities: [
      {
        lg_code: '002-1',
        name: '越後市'
      },
      {
        lg_code: '002-2',
        name: '肥後市'
      },
      {
        lg_code: '002-3',
        name: '陸奥町'
      },
    ],
  },
  {
    name: '肥後県' as PrefectureName,
    cities: [
      {
        lg_code: '003-1',
        name: '熊本市'
      },
      {
        lg_code: '003-2',
        name: '大分市'
      },
      {
        lg_code: '003-3',
        name: '八代市'
      },
    ],
  },
  {
    name: '出羽県' as PrefectureName,
    cities: [
      {
        lg_code: '004-1',
        name: '山形市'
      },
      {
        lg_code: '004-2',
        name: '酒田市'
      },
      {
        lg_code: '004-3',
        name: '仙北町'
      },
    ],
  },
  {
    name: '備後県' as PrefectureName,
    cities: [
      {
        lg_code: '004-1',
        name: '大分市'
      },
      {
        lg_code: '004-2',
        name: '弥彦市'
      },
      {
        lg_code: '004-3',
        name: '出羽市'
      },
    ],
  },
];

Object.freeze(dummyPrefectures);
