import { http, HttpResponse } from "msw";
import type { PaginatedResponse } from "@assetflow/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

// Frozen-contract stub. Frontend track adds real handlers per module here.
// Lists must return { data, meta } (see @assetflow/shared PaginatedResponse).
const emptyPage: PaginatedResponse<never> = {
  data: [],
  meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
};

export const handlers = [
  http.get(`${API_URL}/health`, () =>
    HttpResponse.json({ status: "ok", service: "assetflow-api" }),
  ),
  // Example paginated list — copy this shape per module.
  http.get(`${API_URL}/assets`, () => HttpResponse.json(emptyPage)),
];
