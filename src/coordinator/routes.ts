/** Coordinator URL constants */
export const ROUTES = {
  streamEvents: "/streams/events",
  projectStream: (id: string) => `/projects/${id}/stream`,
} as const;
