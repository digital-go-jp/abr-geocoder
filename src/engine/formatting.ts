type ResidentialSection = {
  blk?: string;
  addr1?: string;
  addr2?: string;
};
export function formatResidentialSection(section: ResidentialSection): string {
  return [section.blk, section.addr1, section.addr2].filter(x => !!x).join('-');
}
