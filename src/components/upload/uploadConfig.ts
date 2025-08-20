// dataConfig.ts

import { path } from "d3";

export interface DataConfig {
  sessionName?: string;
  path?: string;
  subpath?: string;
  filename?: string;
  isNeedId?: boolean;
  requires?: Record<string, { name: string; type: string }>;
  isZip?: boolean;
  isNeedExtract?: boolean;
  subrequires?: Record<string, { name: string; type: string }>;
  isNeedGenerateMetaData?: boolean;
  name?: string;
}

// export const getDataConfig = (dataSection: string, dataType: string): DataConfig => {
//   const folderMapping: Record<
//     string,
//     { name: string; path: string; list: Record<string, Partial<DataConfig>> }
//   > = {
export const getDataConfig = () => ({

  level_1_sections: {
    name: 'Level One Section',
    path: 'public/data/level_one/',
    list: {
      info: {
        name: 'Info',
        path: 'excel_files/',
        filename: 'level_1_sections_info.json',
        isDirectUpdate: true,
        isGit: true,
      },
      // planset: {
      //   name: 'Plan Sets',
      //   path: 'sections/',
      //   requires: { id: { name: 'Sections ID', type: 'text' } },
      //   list: {
      //     info: {
      //       name: 'Info',
      //       path: '/',
      //       filename: 'csj_list.json',
      //     },
      //     file: {
      //       name: 'Images',
      //       path: 'section_data/plan_sets',
      //       requires: { csj: { name: 'CSJ', type: 'text' } },
      //       isZip: true,
      //       isNeedExtract: false,
      //       isNeedGenerateMetaData: true,
      //     },
      //   },
      // },
      // survey: {
      //   name: 'Survey',
      //   path: 'sections/',
      //   requires: { id: { name: 'Sections ID', type: 'text' } },
      //   list: {
      //     info: {
      //       name: 'Info',
      //       path: '/',
      //       filename: 'picture_dates.json',
      //     },
      //     file: {
      //       name: 'Images',
      //       path: 'survey_data/pictures',
      //       requires: { date: { name: 'Date', type: 'text' } },
      //       isZip: true,
      //       isNeedExtract: true,
      //       isNeedGenerateMetaData: true,
      //     },
      //   },
      // },
    },
  },
  special: {
    name: 'Special Section',
    path: 'public/data/special_sections/',
    list: {
      activecrack: {
        name: 'Active Crack Control',
        path: 'active_crack_control_sections/',
        requires: { id: { name: 'Sections ID', type: 'text' } },
        list: {
          info: {
            name: 'Info',
            path: 'excel_files/',
            filename: 'active_crack_control_info.json',
          },
        },
      },
      bonded: {
        name: 'Bonded Concrete Overlay',
        path: 'bonded_concrete_overlay/',
        requires: { id: { name: 'Sections ID', type: 'text' } },
        list: {
          info: {
            name: 'Info',
            path: 'excel_files/',
            filename: 'bonded_overlay_info.json',
          },
        },
      },
      prestressed: {
        name: 'Cast-in-Place Prestressed Pavement',
        path: 'cast-in-place_prestressed_pavement/',
        requires: { id: { name: 'Sections ID', type: 'text' } },
        list: {
          info: {
            name: 'Info',
            path: 'excel_files/',
            filename: 'cast-in-place_prestressed_pavement_info.json',
          },
        },
      },
      fasttrack: {
        name: 'Fast Track CRCP',
        path: 'fast_track_CRCP/',
        requires: { id: { name: 'Sections ID', type: 'text' } },
        list: {
          info: {
            name: 'Info',
            path: 'excel_files/',
            filename: 'fast_track_pavement_info.json',
          },
        },
      },
      ltpp: {
        name: 'LTPP Sections',
        path: 'LTPP_sections/',
        requires: { id: { name: 'Sections ID', type: 'text' } },
        list: {
          info: {
            name: 'Info',
            path: 'excel_files/',
            filename: 'ltpp_sections_info.json',
          },
        },
      },
      ngcs: {
        name: 'Next Generation Concrete Surfacing',
        path: 'next_generation_concrete_surfacing/',
        requires: { id: { name: 'Sections ID', type: 'text' } },
        list: {
          info: {
            name: 'Info',
            path: 'excel_files/',
            filename: 'ngcs_info.json',
          },
        },
      },
      precast: {
        name: 'Precast Pavement',
        path: 'precast_pavement/',
        requires: { id: { name: 'Sections ID', type: 'text' } },
        list: {
          info: {
            name: 'Info',
            path: 'excel_files/',
            filename: 'precast_pavement_info.json',
          },
        },
      },
      rca: {
        name: 'Recycled Concrete Aggregate Pavement',
        path: 'recycled_concrete_aggregate_pavement/',
        requires: { id: { name: 'Sections ID', type: 'text' } },
        list: {
          info: {
            name: 'Info',
            path: 'excel_files/',
            filename: 'recycled_concrete_pavement_info.json',
          },
        },
      },
      rccp: {
        name: 'Roller Compacted Concrete Pavement',
        path: 'roller_compacted_concrete_pavement/',
        requires: { id: { name: 'Sections ID', type: 'text' } },
        list: {
          info: {
            name: 'Info',
            path: 'excel_files/',
            filename: 'rccp_info.json',
          },
        },
      },
      twolift: {
        name: 'Two Lift CRCP',
        path: 'two_lift_CRCP/',
        requires: { id: { name: 'Sections ID', type: 'text' } },
        list: {
          info: {
            name: 'Info',
            path: 'excel_files/',
            filename: 'two_lift_section_info.json',
          },
        },
      },
      unbonded: {
        name: 'Unbonded Concrete Overlay',
        path: 'unbonded_concrete_overlay/',
        requires: { id: { name: 'Sections ID', type: 'text' } },
        list: {
          info: {
            name: 'Info',
            path: 'excel_files/',
            filename: 'unbonded_overlay_info.json',
          },
        },
      },
      whitetopping: {
        name: 'Whitetopping',
        path: 'whitetopping/',
        requires: { id: { name: 'Sections ID', type: 'text' } },
        list: {
          info: {
            name: 'Info',
            path: 'excel_files/',
            filename: 'whitetopping_info.json',
          },
        },
      },
    },
  },
  experimental: {
    name: 'Experimental Section',
    path: 'public/data/experimental/',
    list: {
      aggregate: {
        name: 'Aggregate Effects',
        path: 'aggregate_effects/',
        requires: { id: { name: 'Sections ID', type: 'text' } },
        list: {
          info: {
            name: 'Info',
            path: 'excel_files/',
            filename: 'aggregate_effects_info.json',
          },
        },
      },
      onevstwo: {
        name: 'One vs Two Mat',
        path: 'one_vs_two_mat/',
        requires: { id: { name: 'Sections ID', type: 'text' } },
        list: {
          info: {
            name: 'Info',
            path: 'excel_files/',
            filename: 'one_vs_two_mat_info.json',
          },
        },
      },
      gradation: {
        name: 'Optimized Aggregate Gradation',
        path: 'optimized_aggregate_gradation/',
        requires: { id: { name: 'Sections ID', type: 'text' } },
        list: {
          info: {
            name: 'Info',
            path: 'excel_files/',
            filename: 'optimized_aggregate_gradation_info.json',
          },
        },
      },
      depth: {
        name: 'Steel Depth',
        path: 'steel_depth/',
        requires: { id: { name: 'Sections ID', type: 'text' } },
        list: {
          info: {
            name: 'Info',
            path: 'excel_files/',
            filename: 'steel_depth_info.json',
          },
        },
      },
      percentage: {
        name: 'Steel Percentage Effects',
        path: 'steel_percentage_effects/',
        requires: { id: { name: 'Sections ID', type: 'text' } },
        list: {
          info: {
            name: 'Info',
            path: 'excel_files/',
            filename: 'steel_percentage_effects_info.json',
          },
        },
      },
    },
  }
});