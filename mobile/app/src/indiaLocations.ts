import data from '@/indiaLocations.json';

export const INDIA_STATES = data.states;
export const indiaCitiesForState = (stateCode: string) =>
  data.cities.filter((city) => city.stateCode === stateCode);
