export type PlaceKind = 'country' | 'state' | 'city' | 'district' | 'street' | 'address' | 'poi' | 'other'

export interface GeocodeResult {
  id: string
  name: string
  /** Human readable context, e.g. "Hamburg, Germany". */
  context: string
  city?: string
  country?: string
  countryCode?: string
  lat: number
  lon: number
  /** [west, south, east, north] */
  bbox?: [number, number, number, number]
  kind: PlaceKind
}

export interface GeocodeResponse {
  results: GeocodeResult[]
}
