import { DatasetMetadata } from '@domain/dataset-metadata';
import { getRequest } from '@domain/http/get-request';
import { StatusCodes } from 'http-status-codes';
import fs from 'node:fs';

export const verifyPartialDownloadedFile = async ({
  metadata,
  targetFile,
  userAgent,
}: {
  metadata: DatasetMetadata;
  targetFile: string;
  userAgent: string;
}): Promise<boolean> => {
  if (!fs.existsSync(targetFile)) {
    return false;
  }

  const stat = await fs.promises.stat(targetFile);

  // 2kbytes ないと判定できないので false
  if (stat.size < 2048) {
    return false;
  }

  // ファイルの末尾1024バイトを比較する
  const startAt = stat.size - 1024;

  const response = await getRequest({
    url: metadata.fileUrl,
    userAgent,
    headers: {
      Range: `bytes=${startAt}-${stat.size - 1}`,
    },
  });

  const recvLast1k = Buffer.from(await response.body.arrayBuffer());
  response.body.destroy();

  if (response.statusCode !== StatusCodes.PARTIAL_CONTENT) {
    return false;
  }

  const contentLength = parseInt(
    (response.headers['content-range'] as string).split('/')[1]
  );
  if (contentLength < stat.size) {
    return false;
  }

  const fileLast1k = Buffer.alloc(1024);
  const fd = await fs.promises.open(targetFile, 'r');
  await fd.read(fileLast1k, 0, 1024, startAt);
  fd.close();

  return Buffer.compare(fileLast1k, recvLast1k) === 0;
};
