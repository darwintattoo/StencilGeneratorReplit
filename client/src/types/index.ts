export interface StencilResponse {
  run_id?: string;
  request_id?: string;
  deployment_id?: string;
  status?: string;
  created_at?: string;
  queue_position?: number;
  [key: string]: any;
}

export interface StencilJobStatus {
  status: string;
  startedAt?: string;
  completedAt?: string;
  outputs?: {
    image?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

export interface StencilError {
  error: string;
  message: string;
  status_code?: number;
  [key: string]: any;
}
