export type AuthUser = {
  id?: string
  _id?: string
  email?: string
  name?: string
  picture?: string
  image?: string
  [key: string]: unknown
}

export type GoogleAuthResponse = {
  token: string
  user: AuthUser
  created?: boolean
}

export type AuthMeResponse = {
  user: AuthUser
} | AuthUser

export type AuthConfigResponse = {
  clientId?: string
  googleClientId?: string
}
