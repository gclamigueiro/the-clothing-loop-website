import { Sizes } from "./enums";
import type { UID, User } from "./types";
import axios from "./index";

export interface RequestRegisterUser {
  name: string;
  email: string;
  address: string;
  phone_number: string;
  newsletter: boolean;
  sizes: Array<Sizes | string>;
  longitude: number;
  latitude: number;
}

export interface RequestRegisterChain {
  name: string;
  description: string;
  address: string;
  country_code?: string;
  latitude: number;
  longitude: number;
  radius: number;
  open_to_new_members: boolean;
  sizes: Array<Sizes | string> | null;
  genders: Array<Sizes | string> | null;
  allow_toh: boolean;
}

export function registerChainAdmin(
  user: RequestRegisterUser,
  chain: RequestRegisterChain,
) {
  return axios.post<never>("/v2/register/chain-admin", { user, chain });
}

export function registerBasicUser(user: RequestRegisterUser, chainUID: UID) {
  return axios.post<never>("/v2/register/basic-user", {
    user,
    chain_uid: chainUID,
  });
}

export function registerOrphanedUser(user: RequestRegisterUser) {
  return axios.post<never>("/v2/register/orphaned-user", {
    user,
  });
}

export function loginEmail(email: string) {
  return axios.post<unknown>("/v2/login/email", { email });
}

export function loginEmailAndAddToChain(email: string, chainUID: UID) {
  return axios.post<unknown>("/v2/login/email", {
    email,
    chain_uid: chainUID,
  });
}

export function loginValidate(u: string, apiKey: string, chainUID: UID) {
  let params: Record<string, string> = { u, apiKey };
  if (chainUID) {
    params["c"] = chainUID;
  }
  return axios.get<{ user: User }>(`/v2/login/validate`, {
    params,
  });
}

export function logout() {
  return axios.delete<never>("/v2/logout");
}

export function refreshToken() {
  return axios.post<never>("/v2/refresh-token");
}
