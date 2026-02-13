
export interface TorqueSpec {
  part: string;
  value: string; // e.g., "110 Nm"
  size?: string; // e.g., "14mm Hex" or "M12"
}

export interface AftermarketPart {
  brand: string;
  part_number: string;
  estimated_price: string;
}

export interface MaintenanceItem {
  item: string; // e.g., "Engine Oil", "CVT Fluid", "Spark Plugs"
  spec: string; // e.g., "SAE 0W-20 API SP", "NGK LFR6AIX-11"
  value: string; // e.g., "4.3L (w/ Filter), 4.0L (w/o Filter)" or "4 Pcs"
  oem_part_number?: string; // New
  oem_brand?: string; // New
  aftermarket_parts?: AftermarketPart[]; // New
}

export interface VideoTutorial {
  title: string;
  url: string;
}

export interface DTCItem {
  code: string; // e.g., "P0300"
  definition: string; // Indonesian explanation
  possible_cause: string;
  related_components: string; // New: e.g. "Oxygen Sensor, ECU"
  symptoms: string; // New: e.g. "MIL ON, Rough Idle"
  fix_suggestion: string; // New: e.g. "Check voltage, Replace Sensor"
}

export interface TSBItem {
  id: string; // e.g., "TSB-21-001"
  summary: string;
}

export interface CostEstimation {
  parts_total: string; // e.g. "Rp 1.200.000"
  labor_cost: string; // e.g. "Rp 350.000"
  hourly_rate: string; // New: e.g. "Rp 225.000 / Jam"
  total_estimate: string; // e.g. "Rp 1.550.000 - Rp 1.800.000"
}

export interface SimilarCase {
  case_name: string; // e.g. "Kasus Hilang Tenaga Innova Reborn (P0093)"
  relevance_score: string; // e.g. "95% Match - High Probability"
  related_dtc: string[];
  culprit_component: string; // e.g. "Suction Control Valve (SCV)"
  symptoms_match: string; // e.g. "Mesin pincang saat idle, susah start pagi"
  solution_steps: string[]; // Detailed troubleshooting steps
  video_ref: VideoTutorial;
  image_search_keywords: string; // For generating detailed visualization
}

export interface MechanicResponse {
  vehicle_info: string;
  component_id: string; 
  component_name: string; 
  diagnosis: string[];
  similar_cases: SimilarCase[]; // NEW: Global Similar Cases
  dtc_list: DTCItem[]; 
  tsb_list: TSBItem[]; 
  manual_summary: string;
  wiring_diagram_desc: string; 
  wiring_search_keywords: string;
  maintenance_data: MaintenanceItem[]; 
  torque_specs: TorqueSpec[]; 
  tools_list: string[];
  safety_warning: string[];
  sop_steps: string[]; 
  video_tutorials: VideoTutorial[];
  estimated_work_time: string; // New: Flat Rate Time e.g. "1.5 Jam"
  cost_estimation: CostEstimation; // New: Dealer cost estimate
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  data?: MechanicResponse | null;
  timestamp: Date;
}