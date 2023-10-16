import { CKANPackageResource } from './ckan-package-resource';

export type CKANPackageShow = {
  id: string;
  title: string;
  resources: CKANPackageResource[];
};
