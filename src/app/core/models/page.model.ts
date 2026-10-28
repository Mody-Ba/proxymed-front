/** Page de resultats renvoyee par les services PROXYMED (PageResponse). page commence a 0. */
export interface PageResponse<T> {
  elements: T[];
  page: number;
  taille: number;
  totalElements: number;
  totalPages: number;
}
