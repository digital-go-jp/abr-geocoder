/**
 * Clean Architectureに基づく分類。
 * ソフトウェア全体を支える コア機能
 *
 * データエンティ、および、横断的に使用する関数など。
 * 基本的にクラスや機能そのものが他のクラスなどから独立していて、
 * 単体では何も出来ない機能を配置する。
 *
 */
export * from './AbrgError';
export * from './AbrgMessage';
export * from './GeocodeResult.class';
export * from './RegExpEx';
export * from './bubblingFindFile';
export * from './dataset';
export * from './db';
export * from './findTargetFilesInZipFiles';
export * from './getDataDir';
export * from './isKanjiNumberFollewedByCho';
export * from './jisKanji';
export * from './kan2num';
export * from './query.class';
export * from './types';
export * from './unzipArchive';
