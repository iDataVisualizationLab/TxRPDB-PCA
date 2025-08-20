export type SideNavItem = {
  title: string;
  name: string;
  path: string;
  content?: string;
  icon?: JSX.Element;
  submenu?: boolean;
  isTable?: boolean;
  tableData?: { [key: string]: any }[];
  isSecMenu?: boolean;  
  size?: string;
  subMenuItems?: SideNavItem[];
  allowedRoles?: string[];
};
