import { createClient, PostgrestSingleResponse, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/supabase';

const supabaseUrl: any = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey: any = import.meta.env.VITE_SUPABASE_ANON_KEY;

const SBase = createClient<Database>(supabaseUrl, supabaseAnonKey);

export default SBase; 

export interface TGID {
  created_at: string;
  id: number;
  tgid: string;
  username: string | null;
  tgbro: string | null;
  avatar: string | null;
  firstname?: string | null;
  lastname?: string | null;
  bio?: string | null;
  lng?: string | null;
  is_premium?: boolean;
}

/** ******************** */
export async function getIds(SBase:SupabaseClient) {
  const result: PostgrestSingleResponse<TGID[]> = await SBase.from('ids').select();
  //console.log('%cids: %o', `color: firebrick; background-color: white`, result.data);  
  //console.log('ids: ', result.data);//setIds(result.data||[]);
  return result.data||[];
}

export async function getRow(tgid: string) {
  const result: PostgrestSingleResponse<TGID[]> = await SBase.from('ids').select().eq('tgid', tgid);
  //console.log('%cid: %o', `color: firebrick; background-color: white`, result.data);  
  return result.data;
}

export async function checkTGId(tgid: string) {
  const result: PostgrestSingleResponse<TGID[]> = await SBase.from('ids').select().eq('tgid', tgid);
  //console.log('%cid: %o', `color: firebrick; background-color: white`, result.data);  
  return result.data;
}

export async function addTGId(tgid: string, username?: string, avatar?: string) {
  const result = await SBase
    .from('ids')
    .insert([
      { tgid: tgid, username: username, avatar: avatar },
    ])
    .select();
    //console.log('%cid: %o', `color: firebrick; background-color: white`, result.status);
  return result.data;
}

export async function addTGIdWithBro(tgid: string, tgbro: string, username?: string, avatar?: string) {
  const exist = await SBase
    .from('ids')
    .select('*')
    .eq('tgid', tgid);

  if (exist.data && exist.data.length > 0) {
    console.log('%cid: %o', `color: firebrick; background-color: white`, exist.data);
    return exist.data;
  }

  const result = await SBase
    .from('ids')
    .insert([
      { tgid: tgid, tgbro: tgbro, username: username, avatar: avatar },
    ])
    .select();
    console.log('%cid: %o', `color: firebrick; background-color: white`, result.status);
  return result.data;
}

export async function updateTGUsername(tgid: string, username: string) {
  const result = await SBase
    .from('ids')
    .update({ username: username })
    .eq('tgid', tgid)
    .select();
    console.log('%cid: %o', `color: firebrick; background-color: white`, result.status);
  return result.data;
}

export async function updateTGUser(
  tgid: string,
  username: string,
  firstname: string,
  lastname: string,
  lng?: string,
  is_premium?: boolean
) {
  const result = await SBase
    .from('ids')
    .update({ username: username, firstname: firstname, lastname: lastname, is_premium: is_premium, lng: lng })
    .eq('tgid', tgid)
    .select();
    console.log('%cid: %o', `color: firebrick; background-color: white`, result.status);
  return result.data;
}

export async function updateTGAvatar(tgid: string, avatar: string) {
  const result = await SBase
    .from('ids')
    .update({ avatar: avatar })
    .eq('tgid', tgid)
    .select();
    console.log('%cid: %o', `color: firebrick; background-color: white`, result.status);
  return result.data;
}

export async function updateTGBio(tgid: string, bio: string) {
  const result = await SBase
    .from('ids')
    .update({ bio: bio })
    .eq('tgid', tgid)
    .select();
    console.log('%cid: %o', `color: firebrick; background-color: white`, result.status);
  return result.data;
}

export async function getTableCount(): Promise<number | null> {
  const { count, error } = await SBase
    .from('ids')
    .select('*', {
      count: 'exact',
      head: true
    });

  if (error) {
    console.error('Ошибка запроса количества:', error.message);
    return null;
  }

  return count;
}


/** ******************** */