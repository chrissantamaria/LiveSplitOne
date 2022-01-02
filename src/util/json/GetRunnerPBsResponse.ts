export interface GetRunnerPBsResponse {
  pbs: RunnerPB[];
}

// Response contains lots of additional data,
// only typing the necessary fields
interface RunnerPB {
  id: string;
  game: {
    shortname: string;
  };
}
