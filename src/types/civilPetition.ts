export type CivilPetitionInstitution = {
  id: string
  name: string
  address?: string | null
  phone?: string | null
  latitude?: string | null
  longitude?: string | null
}

export type CivilPetitionStepMode = 'ONLINE' | 'OFFLINE' | 'HYBRID' | string

export type CivilPetitionStepRecord = {
  id?: string | number
  order?: number | null
  mode?: CivilPetitionStepMode | null
  content: string
  linkUrl?: string | null
  institutions?: CivilPetitionInstitution[]
}

export type CivilPetitionStep = string | CivilPetitionStepRecord

export type CivilPetition = {
  infoId: string
  cpName: string
  simple: string
  descriptions: string[]
  offlineSteps: CivilPetitionStep[]
  onlineSteps: CivilPetitionStep[]
}
