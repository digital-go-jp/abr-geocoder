import {CKANPackageShow, CKANResponse, DatasetMetadata} from '../types';

export const getDatasetMetadata = async ({
  ckanBaseUrl,
  ckanId,
  userAgent,
}: {
  ckanBaseUrl: string;
  ckanId: string;
  userAgent: string;
}): Promise<DatasetMetadata> => {
  const metaResp = await fetch(
    `${ckanBaseUrl}/api/3/action/package_show?id=${ckanId}`,
    {
      headers: {
        'user-agent': userAgent,
      },
    }
  );

  if (!metaResp.ok) {
    const body = await metaResp.text();
    console.error(`Body: ${body}`);
    throw new Error(
      `${ckanId} を読み込むときに失敗しました。もう一度お試してください。 (HTTP: ${metaResp.status} ${metaResp.statusText})`
    );
  }

  const metaWrapper = (await metaResp.json()) as CKANResponse<CKANPackageShow>;
  if (metaWrapper.success === false) {
    throw new Error(
      `${ckanId} を読み込むときに失敗しました。もう一度お試してください。`
    );
  }

  const meta = metaWrapper.result;
  const csvResource = meta.resources.find(x =>
    x.format.toLowerCase().startsWith('csv')
  );

  if (!csvResource) {
    throw new Error(
      `${ckanId} に該当のCSVリソースが見つかりませんでした。ご確認ください: ${ckanBaseUrl}/dataset/${ckanId}`
    );
  }

  return {
    fileUrl: csvResource.url,
    lastModified: csvResource.last_modified,
  };
};
