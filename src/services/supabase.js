import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lhrhxgorlynczwbmfwbt.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_mO782vIBENNmrtNsIGiImQ_ubow6b7j';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Auth Helper Methods
export const loginUser = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  if (error) throw error;
  
  // Fetch user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single();

  return { user: data.user, profile };
};

export const registerSeller = async ({ email, password, nom, prenom, telephone, boutique, categorie }) => {
  if (!email.toLowerCase().endsWith('@univ-thies.sn')) {
    throw new Error("L'adresse email doit appartenir à l'université (@univ-thies.sn)");
  }

  // 1. Auth Sign Up
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password
  });

  if (authError) throw authError;

  const user = authData.user;
  if (!user) throw new Error("Erreur lors de la création du compte.");

  // 2. Insert Profile row
  const { error: profileError } = await supabase.from('profiles').insert([
    {
      id: user.id,
      nom,
      prenom,
      telephone,
      boutique: boutique || `${prenom}'s Shop`,
      categorie: categorie || 'general',
      role: 'vendeur'
    }
  ]);

  if (profileError) {
    console.error("Profile insertion error:", profileError);
  }

  return { user, role: 'vendeur' };
};

export const logoutUser = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) console.error("SignOut error:", error);
};

// Products API Methods
export const fetchProducts = async () => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*, seller:seller_id(prenom, nom, is_open)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.warn("Failed to fetch products from Supabase:", err.message);
    return [];
  }
};

export const insertProduct = async (productData, userId) => {
  const { data, error } = await supabase.from('products').insert([
    {
      seller_id: userId,
      title: productData.title,
      price: productData.price,
      old_price: productData.oldPrice || null,
      category: productData.category,
      description: productData.description,
      image_url: productData.image,
      pavillons: productData.pavillons,
      icon: productData.icon || 'fa-box'
    }
  ]).select();

  if (error) throw error;
  return data?.[0];
};
