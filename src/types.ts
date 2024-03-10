export interface MapStats {
  mapName: string;
  leftTeamScore: number | null;
  rightTeamScore: number | null;
}

export interface MatchStats {
  bestOf: number;
  leftTeam: string;
  rightTeam: string;
  maps: MapStats[];
}
