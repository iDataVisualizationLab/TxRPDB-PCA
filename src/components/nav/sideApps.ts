export type SideApp = {
  name: string;
  url: string;
  allowedRoles: string[];
};

export const sideApps: SideApp[] = [
  // { name: 'RPDBv1', url: 'https://idatavisualizationlab.github.io/RPDBv1/', allowedRoles: ['admin', 'user'] },
  // { name: 'RPDBv2', url: 'https://idatavisualizationlab.github.io/RPDBv2/', allowedRoles: ['admin', 'user'] },
  { name: 'RPDBv3.0', url: 'https://idatavisualizationlab.github.io/RPDBv3.0/', allowedRoles: ["admin", "user", "guest"]},
  { name: 'RPDB LineUp', url: 'https://idatavisualizationlab.github.io/RPDB_LineUp/', allowedRoles: ['admin', 'user'] },
];