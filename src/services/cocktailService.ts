import { Recipe, RecipeIngredient, TastingNote, Ingredient } from '../types';
import { STANDARD_INGREDIENTS } from '../constants';
import { db, auth } from './firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp,
  query,
  where,
  orderBy
} from 'firebase/firestore';

enum OperationType { CREATE = 'create', UPDATE = 'update', DELETE = 'delete', LIST = 'list', GET = 'get', WRITE = 'write', }

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function getIngredients(): Promise<Ingredient[]> {
  return STANDARD_INGREDIENTS.map(item => ({
    id: item.id,
    name: item.name,
    category: item.category,
    alcoholContent: item.abv,
    substitutes: []
  }));
}

export async function getRecipes(): Promise<Recipe[]> {
  if (!auth.currentUser) return [];
  try {
    const qSnapshot = await getDocs(collection(db, 'recipes'));
    return qSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Recipe));
  } catch (e) {
    handleFirestoreError(e, OperationType.LIST, 'recipes');
  }
}

export async function saveRecipe(recipe: Omit<Recipe, 'createdAt'>, ingredients: RecipeIngredient[]) {
  if (!auth.currentUser) throw new Error('Not signed in');
  const id = recipe.id || Math.random().toString(36).substring(2, 11);
  
  // Clean undefined values from recipe object
  const cleanedRecipe = Object.fromEntries(
    Object.entries(recipe).filter(([_, v]) => v !== undefined)
  );

  const newRecipe = { 
    ...cleanedRecipe, 
    id, 
    createdAt: serverTimestamp(), 
    ingredients,
    authorId: auth.currentUser.uid 
  };
  try {
    await setDoc(doc(db, 'recipes', id), newRecipe);
    return id;
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, 'recipes/' + id);
  }
}

export async function updateRecipe(recipeId: string, recipe: Partial<Recipe>, ingredients?: RecipeIngredient[]) {
  try {
    // Clean undefined values
    const cleanedUpdate = Object.fromEntries(
      Object.entries(recipe).filter(([_, v]) => v !== undefined)
    );

    await updateDoc(doc(db, 'recipes', recipeId), { 
      ...cleanedUpdate, 
      ...(ingredients ? { ingredients } : {}),
      updatedAt: serverTimestamp()
    });
  } catch (e) {
    handleFirestoreError(e, OperationType.UPDATE, 'recipes/' + recipeId);
  }
}

export async function deleteRecipe(recipeId: string) {
  try {
    await deleteDoc(doc(db, 'recipes', recipeId));
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, 'recipes/' + recipeId);
  }
}

export async function getMyBar(): Promise<string[]> {
  if (!auth.currentUser) return [];
  try {
    const docSnap = await getDoc(doc(db, 'users', auth.currentUser.uid));
    if (docSnap.exists()) return docSnap.data().myBar || [];
    return [];
  } catch (e) {
    handleFirestoreError(e, OperationType.GET, 'users/' + auth.currentUser.uid);
  }
}

export async function updateMyBar(ingredientIds: string[]) {
  if (!auth.currentUser) return;
  try {
    await setDoc(doc(db, 'users', auth.currentUser.uid), { 
      userId: auth.currentUser.uid, 
      myBar: ingredientIds,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, 'users/' + auth.currentUser.uid);
  }
}

export function canMakeRecipe(recipe: Recipe, myBar: string[]): boolean {
  if (!recipe.ingredients) return false;
  return recipe.ingredients.every(ing => {
    const key = ing.ingredientId === 'others' ? ing.originalName : ing.ingredientId;
    return key && myBar.includes(key);
  });
}

export async function saveReview(recipeId: string, review: Omit<TastingNote, 'id' | 'createdAt' | 'userId' | 'userName'>) {
  if (!auth.currentUser) throw new Error('Not signed in');
  const id = Math.random().toString(36).substring(2, 11);
  const newReview = { 
    ...review, 
    id, 
    createdAt: serverTimestamp(), 
    userId: auth.currentUser.uid, 
    userName: auth.currentUser.displayName || 'Me' 
  };
  try {
    await setDoc(doc(db, 'recipes', recipeId, 'reviews', id), newReview);
    return id;
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, 'recipes/' + recipeId + '/reviews/' + id);
  }
}

export async function updateReview(recipeId: string, reviewId: string, review: Partial<TastingNote>) {
  try {
    await updateDoc(doc(db, 'recipes', recipeId, 'reviews', reviewId), review);
  } catch (e) {
    handleFirestoreError(e, OperationType.UPDATE, 'recipes/' + recipeId + '/reviews/' + reviewId);
  }
}

export async function deleteReview(recipeId: string, reviewId: string) {
  try {
    await deleteDoc(doc(db, 'recipes', recipeId, 'reviews', reviewId));
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, 'recipes/' + recipeId + '/reviews/' + reviewId);
  }
}

export async function getReviews(recipeId: string): Promise<TastingNote[]> {
  try {
    const q = query(collection(db, 'recipes', recipeId, 'reviews'), orderBy('createdAt', 'desc'));
    const qSnapshot = await getDocs(q);
    return qSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TastingNote));
  } catch (e) {
    handleFirestoreError(e, OperationType.LIST, 'recipes/' + recipeId + '/reviews');
  }
}

export async function seedIngredients() {}
