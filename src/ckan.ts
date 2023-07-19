export const CKAN_BASE_REGISTRY_URL =
  'https://catalog.registries.digital.go.jp/rc';

export type CKANResponse<T = any> =
  | {
      success: false;
    }
  | {
      success: true;
      result: T;
    };

export type CKANPackageShow = {
  id: string;
  title: string;
  resources: CKANPackageResource[];
};

export type CKANPackageResource = {
  description: string;
  last_modified: string;
  id: string;
  url: string;
  format: string;
};
