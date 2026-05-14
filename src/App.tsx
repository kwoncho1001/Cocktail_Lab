import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './services/firebase';
import Login from './components/Login';
import { 
  Wine, 
  Plus, 
  Search, 
  Library, 
  User, 
  ChevronRight, 
  Link as LinkIcon, 
  CheckCircle2,
  AlertCircle,
  Loader2,
  Heart,
  Star,
  MessageSquare,
  Edit2,
  Tag as TagIcon,
  Trash2
} from 'lucide-react';
import { 
  Radar, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis,
  ResponsiveContainer 
} from 'recharts';
import { 
  getIngredients, 
  getRecipes, 
  getMyBar, 
  updateMyBar, 
  saveRecipe, 
  updateRecipe,
  deleteRecipe,
  canMakeRecipe,
  getReviews,
  saveReview,
  updateReview,
  deleteReview
} from './services/cocktailService';
import { 
  Ingredient,
  Recipe,
  RecipeIngredient,
  TastingNote
} from './types';
import { parseRecipe, ExtractedRecipe } from './services/geminiService';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [view, setView] = useState<'home' | 'parser' | 'mybar' | 'recipes'>('home');
  const [loading, setLoading] = useState(true);
  const [unit, setUnit] = useState<'ml' | 'oz'>('ml');
  
  // Data State
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [myBar, setMyBar] = useState<string[]>([]);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editInstructions, setEditInstructions] = useState('');
  const [editIngredients, setEditIngredients] = useState('');

  // Derived Ingredients List (Standard + Custom from Recipes)
  const allIngredients = (() => {
    const combined = [...ingredients];
    const existingIds = new Set(ingredients.map(i => i.id));
    const processedCustomNames = new Set<string>();

    recipes.forEach(r => {
      r.ingredients?.forEach(ing => {
        if (ing.ingredientId === 'others' && ing.originalName) {
          if (!processedCustomNames.has(ing.originalName)) {
            combined.push({
              id: ing.originalName, // Use name as ID for custom ones
              name: ing.originalName,
              category: 'Others'
            });
            processedCustomNames.add(ing.originalName);
          }
        } else if (ing.ingredientId && !existingIds.has(ing.ingredientId)) {
          // If for some reason it's a valid ID but not in our master list anymore
          // (shouldn't happen with seed, but good for robustness)
        }
      });
    });

    return combined;
  })();
  
  // Parser State
  const [parseInput, setParseInput] = useState('');
  const [parsing, setParsing] = useState(false);
  const [preview, setPreview] = useState<ExtractedRecipe | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser);
        setAuthLoading(false);
        if (currentUser) {
            initData();
        } else {
            setLoading(false);
        }
    });
    return unsubscribe;
  }, []);

  const initData = async () => {
    console.log("initData started");
    setLoading(true);
    try {
      console.log("Fetching ingredients...");
      const ings = await getIngredients();
      setIngredients(ings);
      console.log("Ingredients fetched, fetching recipes and bar...");
      
      // Fetching with a timeout or just logging before each
      const recs = await getRecipes();
      console.log("Recipes fetched:", recs?.length);
      setRecipes(recs || []);
      
      const bar = await getMyBar();
      console.log("Bar stock fetched:", bar?.length);
      setMyBar(bar || []);

      console.log("Data initialization complete");
    } catch (e) {
      console.error("Initial data load failed", e);
    } finally {
      console.log("setLoading(false) called");
      setLoading(false);
    }
  };

  const handleParse = async () => {
    if (!parseInput.trim()) return;
    setParsing(true);
    try {
      const result = await parseRecipe(parseInput);
      if (result.title.toLowerCase().includes("error") || result.ingredients.length === 0) {
        alert("이 입력값으로부터 칵테일 레시피를 찾을 수 없습니다.");
        setParsing(false);
        return;
      }
      setPreview(result);
    } catch (e) {
      console.error(e);
      alert("Failed to parse recipe. Try another source.");
    } finally {
      setParsing(false);
    }
  };

  const handleSaveParsed = async () => {
    if (!preview) return;
    setLoading(true);
    const { title, baseIngredientId, instructions, technique, difficulty, garnish, ingredients: recipeIngs, flavorProfile, history } = preview;
    
    try {
      const recipeIngsData: RecipeIngredient[] = recipeIngs.map(i => ({
        ingredientId: i.mappedId || 'others',
        amount: i.amount,
        unit: i.unit,
        originalName: i.name
      }));

      await saveRecipe({
        id: Math.random().toString(36).substring(2, 11),
        title,
        baseIngredientId,
        instructions,
        technique: technique as any,
        difficulty: difficulty as any,
        garnish,
        flavorProfile,
        history,
      }, recipeIngsData);
      
      setPreview(null);
      setParseInput('');
      await initData();
      setView('recipes');
      alert("Recipe saved to local storage!");
    } catch (e) {
      console.error(e);
      alert("Failed to save recipe.");
    } finally {
      setLoading(false);
    }
  };

  const toggleBarItem = async (id: string) => {
    const newBar = myBar.includes(id) 
      ? myBar.filter(x => x !== id) 
      : [...myBar, id];
    setMyBar(newBar);
    await updateMyBar(newBar);
  };

  const handleUpdateRecipe = async () => {
    if (!editingRecipe || !editingRecipe.id) return;
    setLoading(true);
    try {
      const instructionsArray = editInstructions.split('\n').filter(s => s.trim());
      const ingredientsArray = editIngredients.split('\n').filter(s => s.trim()).map(line => {
        const parts = line.split(' ');
        const amount = parseFloat(parts[0]) || 0;
        const unit = parts[1] || 'ml';
        const name = parts.slice(2).join(' ') || 'unknown';
        return {
          ingredientId: 'others', // Simplified mapping for edit mode
          amount,
          unit,
          originalName: name
        };
      });
      await updateRecipe(editingRecipe.id, {
        title: editTitle,
        instructions: instructionsArray,
      }, ingredientsArray);
      setEditingRecipe(null);
      await initData();
    } catch (e) {
      console.error(e);
      alert("Failed to update recipe.");
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (recipe: Recipe) => {
    setEditingRecipe(recipe);
    setEditTitle(recipe.title);
    setEditInstructions(recipe.instructions.join('\n'));
    setEditIngredients(recipe.ingredients?.map(ing => `${ing.amount} ${ing.unit} ${ing.originalName || ing.ingredientId}`).join('\n') || '');
  };

  const handleDeleteRecipe = async (recipeId: string) => {
    console.log('handleDeleteRecipe called for:', recipeId);
    if (!confirm('정말로 이 레시피를 삭제하시겠습니까?')) return;
    setLoading(true);
    try {
      await deleteRecipe(recipeId);
      console.log('Delete successful');
      await initData();
      alert('레시피가 삭제되었습니다.');
    } catch (e) {
      console.error('Delete failed:', e);
      alert('레시피 삭제에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0a0a] text-white">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 font-sans">
      {/* Sidebar / Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 md:top-0 md:bottom-0 md:left-0 md:w-20 bg-[#111] border-t md:border-t-0 md:border-r border-white/5 flex md:flex-col items-center justify-around md:justify-center gap-8 p-4 z-50">
        {[
          { id: 'home', icon: Wine, label: 'Home' },
          { id: 'parser', icon: Plus, label: 'AI Parse' },
          { id: 'mybar', icon: Search, label: 'My Bar' },
          { id: 'recipes', icon: Library, label: 'Recipes' }
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => { setView(item.id as any); setPreview(null); }}
            className={`flex flex-col items-center gap-1 transition-colors ${view === item.id ? 'text-orange-500' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <item.icon className="w-6 h-6" />
            <span className="text-[10px] uppercase tracking-widest font-medium md:hidden">{item.label}</span>
          </button>
        ))}
      </nav>

      <main className="pb-24 md:pb-8 md:pl-20 p-6 max-w-5xl mx-auto">
        <header className="flex justify-between items-center mb-12">
          <div>
            <h2 className="text-sm font-mono text-orange-500 uppercase tracking-widest mb-1">
              {view === 'home' ? 'Welcome Back' : view.toUpperCase()}
            </h2>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              {view === 'home' && "The Alchemist's Lab"}
              {view === 'parser' && "AI Recipe Extractor"}
              {view === 'mybar' && "Your Home Bar Stock"}
              {view === 'recipes' && "Cocktail Library"}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex bg-[#111] rounded-lg p-1 border border-white/5 mr-4">
              <button 
                onClick={() => setUnit('ml')}
                className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${unit === 'ml' ? 'bg-orange-500 text-white' : 'text-gray-500 hover:text-gray-300'}`}
              >
                ML
              </button>
              <button 
                onClick={() => setUnit('oz')}
                className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${unit === 'oz' ? 'bg-orange-500 text-white' : 'text-gray-500 hover:text-gray-300'}`}
              >
                OZ
              </button>
            </div>
            <div className="w-10 h-10 rounded-full border border-white/10 bg-white/5 flex items-center justify-center">
              <User className="w-5 h-5 text-gray-500" />
            </div>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {view === 'home' && (
            <motion.div 
              key="home"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-12"
            >
              <section>
                <h3 className="text-lg font-semibold mb-6 flex items-center justify-between">
                  Ready to Shake Still
                  <span className="text-xs font-mono text-gray-500">Available Now</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {recipes.filter(r => canMakeRecipe(r, myBar)).length > 0 ? (
                    recipes.filter(r => canMakeRecipe(r, myBar)).map(recipe => (
                      <RecipeCard 
                        key={recipe.id} 
                        recipe={recipe} 
                        available 
                        onEdit={startEditing}
                        onDelete={handleDeleteRecipe}
                        unit={unit} 
                        user={user}
                      />
                    ))
                  ) : (
                    <div className="col-span-full p-12 border border-dashed border-white/10 rounded-2xl text-center">
                      <AlertCircle className="w-8 h-8 text-gray-700 mx-auto mb-4" />
                      <p className="text-gray-500 mb-4">You can't make anything with your current stock.</p>
                      <button onClick={() => setView('mybar')} className="text-orange-500 text-sm font-semibold hover:underline">
                        Update your bar stock
                      </button>
                    </div>
                  )}
                </div>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-6">Recent Additions</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {recipes.slice(0, 4).map(recipe => (
                    <RecipeCard 
                      key={recipe.id} 
                      recipe={recipe} 
                      onEdit={startEditing}
                      onDelete={handleDeleteRecipe}
                      unit={unit} 
                      user={user}
                    />
                  ))}
                </div>
              </section>
            </motion.div>
          )}

          {view === 'parser' && (
            <motion.div 
              key="parser"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-2xl mx-auto"
            >
              <div className="bg-[#151619] rounded-2xl border border-white/5 p-8">
                <p className="text-gray-400 mb-6 text-center text-sm">
                  Describe the drink in detail. AI will handle the data structuring.
                </p>
                <textarea 
                  value={parseInput}
                  onChange={(e) => setParseInput(e.target.value)}
                  placeholder="e.g. 45ml Gin, 15ml Lime juice, 10ml Simple syrup, shake and strain into Coupe."
                  className="w-full h-40 bg-black/50 border border-white/10 rounded-xl p-4 text-sm focus:border-orange-500 outline-none transition-colors mb-6 resize-none"
                />
                <button 
                  onClick={handleParse}
                  disabled={parsing || !parseInput}
                  className="w-full py-4 bg-orange-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-orange-600 disabled:opacity-50"
                >
                  {parsing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wine className="w-5 h-5" />}
                  {parsing ? "Analyzing Magic..." : "Parse with Gemini AI"}
                </button>
              </div>

              {preview && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-8 bg-[#151619] rounded-2xl border border-white/5 overflow-hidden"
                >
                  <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
                    <h3 className="font-bold text-xl">{preview.title}</h3>
                    <span className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-mono uppercase tracking-widest">
                      {preview.difficulty}
                    </span>
                  </div>
                  <div className="p-6 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-4">
                        <h4 className="text-xs font-mono text-gray-500 uppercase tracking-widest">Ingredients</h4>
                        <ul className="space-y-2">
                          {preview.ingredients.map((ing, idx) => (
                            <li key={idx} className="text-sm flex justify-between items-center group">
                              <span className="text-gray-300">
                                {ing.name}
                                {ing.mappedId && (
                                  <span className="ml-2 text-[10px] text-green-500/80 font-mono">Matched</span>
                                )}
                              </span>
                              <span className="font-medium">{ing.amount}{ing.unit}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="space-y-4">
                        <h4 className="text-xs font-mono text-gray-500 uppercase tracking-widest">Details</h4>
                        <div className="space-y-3">
                          <div>
                            <p className="text-[10px] text-gray-500 uppercase font-mono">Technique</p>
                            <p className="text-sm font-medium">{preview.technique}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-500 uppercase font-mono">Garnish</p>
                            <p className="text-sm font-medium">{preview.garnish}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4 pt-6 border-t border-white/5">
                      <h4 className="text-xs font-mono text-gray-500 uppercase tracking-widest">Instructions</h4>
                      <ol className="space-y-3">
                        {preview.instructions.map((step, idx) => (
                          <li key={idx} className="text-sm flex gap-3 text-gray-400">
                            <span className="text-orange-500 font-mono text-xs">{idx + 1}.</span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>

                    {preview.flavorProfile && preview.flavorProfile.length > 0 && (
                      <div className="pt-6 border-t border-white/5">
                        <h4 className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-3">Flavor Profile</h4>
                        <div className="flex flex-wrap gap-2">
                          {preview.flavorProfile.map((tag, idx) => (
                            <span key={idx} className="text-[10px] px-2 py-1 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20 font-mono">
                              #{tag.replace(/^#/, '')}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {preview.history && (
                      <div className="pt-6 border-t border-white/5">
                        <h4 className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-2">History & Story</h4>
                        <p className="text-xs text-gray-400 leading-relaxed italic">{preview.history}</p>
                      </div>
                    )}
                  </div>
                  <div className="p-6 bg-white/5 flex gap-3">
                    <button 
                      onClick={() => setPreview(null)}
                      className="flex-1 py-3 border border-white/10 rounded-xl text-sm font-medium hover:bg-white/5"
                    >
                      Discard
                    </button>
                    <button 
                      onClick={handleSaveParsed}
                      className="flex-1 py-3 bg-white text-black rounded-xl text-sm font-bold hover:bg-gray-200"
                    >
                      Add to Collection
                    </button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {view === 'mybar' && (
            <motion.div 
              key="mybar"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {['Base Spirit', 'Liqueur', 'Juice', 'Syrup', 'Bitters', 'Soda', 'Fruit', 'Others'].map(category => (
                  <div key={category} className="space-y-4">
                    <h3 className="text-xs font-mono text-gray-500 uppercase tracking-tighter border-b border-white/5 pb-2">
                      {category}
                    </h3>
                    <div className="space-y-2">
                      {allIngredients.filter(i => i.category === category).map(ing => (
                        <button
                          key={ing.id}
                          onClick={() => toggleBarItem(ing.id)}
                          className={`w-full flex justify-between items-center p-3 rounded-xl border transition-all text-sm ${myBar.includes(ing.id) ? 'bg-orange-500 text-white border-orange-500' : 'bg-[#151619] border-white/5 text-gray-400'}`}
                        >
                          {ing.name}
                          {myBar.includes(ing.id) ? <CheckCircle2 className="w-4 h-4" /> : <Plus className="w-4 h-4 opacity-30" />}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {view === 'recipes' && (
            <motion.div 
              key="recipes"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              <div className="flex gap-2 p-1 bg-[#151619] rounded-xl w-fit">
                {['All', 'Can Make', 'Favorites'].map(filter => (
                  <button 
                    key={filter}
                    className="px-4 py-2 text-xs font-bold rounded-lg hover:bg-white/5"
                  >
                    {filter}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {recipes.map(recipe => (
                    <RecipeCard 
                      key={recipe.id} 
                      recipe={recipe} 
                      available={canMakeRecipe(recipe, myBar)} 
                      onEdit={startEditing}
                      onDelete={handleDeleteRecipe}
                      unit={unit} 
                      user={user}
                    />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Edit Modal */}
        <AnimatePresence>
          {editingRecipe && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-[#151619] border border-white/10 rounded-2xl w-full max-w-xl p-8 space-y-6"
              >
                <h2 className="text-xl font-bold">Edit Recipe</h2>
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] uppercase font-mono text-gray-500 mb-1 block">Title</label>
                    <input 
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm focus:border-orange-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-mono text-gray-500 mb-1 block">Ingredients (amount unit name, one per line)</label>
                    <textarea 
                      value={editIngredients}
                      onChange={(e) => setEditIngredients(e.target.value)}
                      className="w-full h-40 bg-black/40 border border-white/10 rounded-xl p-3 text-sm focus:border-orange-500 outline-none resize-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-mono text-gray-500 mb-1 block">Instructions (One per line)</label>
                    <textarea 
                      value={editInstructions}
                      onChange={(e) => setEditInstructions(e.target.value)}
                      className="w-full h-40 bg-black/40 border border-white/10 rounded-xl p-3 text-sm focus:border-orange-500 outline-none resize-none"
                    />
                  </div>
                </div>
                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={() => setEditingRecipe(null)}
                    className="flex-1 py-3 border border-white/10 rounded-xl text-sm font-medium hover:bg-white/5"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleUpdateRecipe}
                    className="flex-1 py-3 bg-orange-500 text-white rounded-xl text-sm font-bold hover:bg-orange-600"
                  >
                    Save Changes
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

interface RecipeCardProps {
  recipe: Recipe;
  available?: boolean;
  onEdit?: (recipe: Recipe) => void;
  onDelete?: (recipeId: string) => void;
  unit: 'ml' | 'oz';
  user: any;
  key?: string | number;
}

const TASTING_TAGS = {
  'Fruit': ['#상큼한레몬', '#달콤한베리', '#열대과일', '#청포도'],
  'Herb/Plant': ['#민트', '#풀냄새', '#꽃향기', '#시나몬', '#나무냄새'],
  'Dessert': ['#초콜릿', '#바닐라', '#고소한넛츠', '#카라멜'],
  'Mood': ['#청량함', '#따뜻함', '#묵직함', '#화려함', '#깔끔함']
};

function TastingRadar({ note }: { note: Partial<TastingNote> }) {
  const data = [
    { subject: 'Sweet', A: note.sweet || 0, fullMark: 5 },
    { subject: 'Sour', A: note.sour || 0, fullMark: 5 },
    { subject: 'Alcohol', A: note.alcohol || 0, fullMark: 5 },
    { subject: 'Bitter', A: note.bitter || 0, fullMark: 5 },
    { subject: 'Body', A: note.body || 0, fullMark: 5 },
  ];

  return (
    <div className="w-full h-48">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="60%" data={data}>
          <PolarGrid stroke="#333" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: '#666', fontSize: 10 }} />
          <PolarRadiusAxis domain={[0, 5]} tick={false} tickLine={false} axisLine={false} />
          <Radar
            name="Tasting"
            dataKey="A"
            stroke="#f97316"
            fill="#f97316"
            fillOpacity={0.5}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

function RecipeCard({ recipe, available, onEdit, onDelete, unit, user }: RecipeCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [reviews, setReviews] = useState<TastingNote[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  
  // Review Form State
  const [newRating, setNewRating] = useState(5);
  const [newSweet, setNewSweet] = useState(3);
  const [newSour, setNewSour] = useState(3);
  const [newAlcohol, setNewAlcohol] = useState(3);
  const [newBitter, setNewBitter] = useState(3);
  const [newBody, setNewBody] = useState(3);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newNote, setNewNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'recipe' | 'tasting'>('recipe');

  useEffect(() => {
    if (expanded && recipe.id) {
      loadReviews();
    }
  }, [expanded, recipe.id]);

  const loadReviews = async () => {
    if (!recipe.id) return;
    setLoadingReviews(true);
    const data = await getReviews(recipe.id);
    setReviews(data);
    setLoadingReviews(false);
  };

  const handleAddReview = async () => {
    if (!recipe.id || !newNote.trim()) return;
    setSubmitting(true);
    try {
      if (editingReviewId) {
        await updateReview(recipe.id, editingReviewId, {
          rating: newRating,
          sweet: newSweet,
          sour: newSour,
          alcohol: newAlcohol,
          bitter: newBitter,
          body: newBody,
          tags: selectedTags,
          note: newNote
        });
      } else {
        await saveReview(recipe.id, { 
          rating: newRating, 
          sweet: newSweet,
          sour: newSour,
          alcohol: newAlcohol,
          bitter: newBitter,
          body: newBody,
          tags: selectedTags,
          note: newNote 
        });
      }
      setNewNote('');
      setNewRating(5);
      setSelectedTags([]);
      setShowReviewForm(false);
      setEditingReviewId(null);
      await loadReviews();
    } catch (e) {
      console.error(e);
      alert("Failed to save review.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!recipe.id || !confirm("Delete this tasting note?")) return;
    try {
      await deleteReview(recipe.id, reviewId);
      await loadReviews();
    } catch (e) {
      console.error(e);
    }
  };

  const startEditReview = (review: TastingNote) => {
    if (!review.id) return;
    setEditingReviewId(review.id);
    setNewRating(review.rating);
    setNewSweet(review.sweet || 3);
    setNewSour(review.sour || 3);
    setNewAlcohol(review.alcohol || 3);
    setNewBitter(review.bitter || 3);
    setNewBody(review.body || 3);
    setSelectedTags(review.tags || []);
    setNewNote(review.note);
    setShowReviewForm(true);
  };

  const averageRating = reviews.length > 0 
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const convertAmount = (amount: number, fromUnit: string) => {
    if (unit === 'ml') {
      if (fromUnit.toLowerCase() === 'oz') return (amount * 30).toFixed(0);
      return amount.toFixed(0);
    } else {
      if (fromUnit.toLowerCase() === 'ml') return (amount / 30).toFixed(1);
      return amount.toFixed(1);
    }
  };

  return (
    <motion.div 
      layout
      className={`group relative bg-[#151619] rounded-2xl border transition-all overflow-hidden ${available ? 'border-green-500/20' : 'border-white/5 hover:border-white/20'}`}
    >
      <div className="p-6">
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <h4 className="font-bold text-lg leading-tight group-hover:text-orange-500 transition-colors cursor-pointer" onClick={() => setExpanded(!expanded)}>
              {recipe.title}
            </h4>
            <div className="flex items-center gap-1.5">
              {averageRating ? (
                <div className="flex gap-0.5">
                  {[1,2,3,4,5].map(i => (
                    <Star key={i} className={`w-3 h-3 ${i <= Math.round(Number(averageRating)) ? 'text-orange-500 fill-current' : 'text-gray-800'}`} />
                  ))}
                </div>
              ) : (
                <span className="text-[10px] text-gray-700 font-mono italic">New Recipe</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(user.uid === recipe.authorId || user.email === 'kwoncho1001@gmail.com') && (
              <>
                <button 
                  onClick={(e) => { e.stopPropagation(); onEdit?.(recipe); }}
                  className="p-2 -m-2 text-gray-700 hover:text-blue-500 transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); onDelete?.(recipe.id!); }}
                  className="p-2 -m-2 text-gray-700 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>

        <div className="mt-6 flex gap-4">
          <button 
            onClick={() => { setExpanded(true); setActiveTab('recipe'); }}
            className={`text-[10px] font-bold uppercase tracking-widest transition-all ${expanded && activeTab === 'recipe' ? 'text-orange-500' : 'text-gray-600 hover:text-gray-400'}`}
          >
            Recipe
          </button>
          <button 
            onClick={() => { setExpanded(true); setActiveTab('tasting'); }}
            className={`text-[10px] font-bold uppercase tracking-widest transition-all ${expanded && activeTab === 'tasting' ? 'text-orange-500' : 'text-gray-600 hover:text-gray-400'}`}
          >
            Tasting
          </button>
          
          <button 
            onClick={() => setExpanded(!expanded)}
            className="ml-auto text-gray-700 hover:text-white transition-all"
          >
            <ChevronRight className={`w-4 h-4 transition-transform ${expanded ? 'rotate-90' : ''}`} />
          </button>
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-6 pt-6 border-t border-white/5 overflow-hidden"
            >
              {activeTab === 'recipe' ? (
                <div className="space-y-6">
                  <div className="bg-black/30 rounded-2xl p-6 border border-white/5 space-y-6">
                    <div className="flex flex-wrap gap-2">
                      {recipe.ingredients?.map((ing, idx) => (
                        <span 
                          key={idx} 
                          className={`text-[10px] px-3 py-1.5 rounded-full bg-white/5 border border-white/5 ${available && ing.ingredientId !== 'others' ? 'text-green-400 border-green-500/20' : 'text-gray-400'}`}
                        >
                          <span className="font-bold text-white/80 mr-1">{convertAmount(ing.amount, ing.unit)}{unit}</span>
                          {ing.ingredientId === 'others' ? ing.originalName : ing.ingredientId}
                        </span>
                      ))}
                    </div>

                    {recipe.flavorProfile && recipe.flavorProfile.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {recipe.flavorProfile.map((tag, idx) => (
                          <span key={idx} className="text-[10px] px-2 py-1 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20 font-mono">
                            #{tag.replace(/^#/, '')}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="h-px bg-white/5" />
                    <ol className="space-y-4">
                      {recipe.instructions.map((step, idx) => (
                        <li key={idx} className="text-xs flex gap-4 text-gray-300 leading-relaxed items-start">
                          <span className="w-5 h-5 rounded-full bg-orange-500/10 text-orange-500 flex items-center justify-center text-[10px] font-mono shrink-0">
                            {idx + 1}
                          </span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                    
                    {recipe.history && (
                      <div className="pt-4 border-t border-white/5">
                        <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-2">History & Story</p>
                        <p className="text-xs text-gray-400 leading-relaxed italic">{recipe.history}</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="flex justify-between items-center bg-white/5 p-4 rounded-xl">
                    <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Tasting Notes</span>
                    <button 
                      onClick={() => setShowReviewForm(!showReviewForm)}
                      className="text-[10px] bg-orange-500 text-white px-3 py-1.5 rounded-full font-bold hover:bg-orange-600 transition-all"
                    >
                      {showReviewForm ? "Cancel" : "Add Note"}
                    </button>
                  </div>

                  <AnimatePresence>
                    {showReviewForm && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="bg-black/20 rounded-2xl p-6 border border-white/10 overflow-hidden space-y-8"
                      >
                         {/* Form Content - Title & Rating */}
                         <div className="text-center">
                          <div className="flex justify-center gap-2">
                            {[1,2,3,4,5].map(star => (
                              <button 
                                key={star} 
                                onClick={() => setNewRating(star)}
                                className={`transition-all ${star <= newRating ? 'text-orange-500' : 'text-gray-800'}`}
                              >
                                <Star className="w-6 h-6 fill-current" />
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                           <TastingRadar note={{ sweet: newSweet, sour: newSour, alcohol: newAlcohol, bitter: newBitter, body: newBody }} />
                           <div className="space-y-4">
                            {[
                               { label: 'Sweet', val: newSweet, set: setNewSweet },
                               { label: 'Sour', val: newSour, set: setNewSour },
                               { label: 'Alcohol', val: newAlcohol, set: setNewAlcohol },
                               { label: 'Bitter', val: newBitter, set: setNewBitter },
                               { label: 'Body', val: newBody, set: setNewBody },
                            ].map(slider => (
                               <div key={slider.label} className="space-y-1">
                                 <div className="flex justify-between text-[10px] font-mono text-gray-600">
                                   <span>{slider.label}</span>
                                   <span className="text-orange-500">{slider.val}</span>
                                 </div>
                                 <motion.input 
                                   type="range" min="1" max="5" step="1"
                                   value={slider.val}
                                   onChange={(e) => slider.set(parseInt(e.target.value))}
                                   className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-orange-500"
                                 />
                               </div>
                            ))}
                           </div>
                        </div>

                        <textarea 
                          value={newNote}
                          onChange={(e) => setNewNote(e.target.value)}
                          placeholder="Brief tasting notes..."
                          className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-xs outline-none focus:border-orange-500 h-24"
                        />

                        <button 
                          onClick={handleAddReview}
                          disabled={submitting || !newNote.trim()}
                          className="w-full py-4 bg-white text-black text-xs font-bold rounded-xl disabled:opacity-50"
                        >
                          {submitting ? "Saving..." : (editingReviewId ? "Update Review" : "Save Note")}
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="space-y-6">
                    {loadingReviews ? (
                      <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-gray-700" /></div>
                    ) : reviews.length > 0 ? (
                      reviews.map(review => (
                        <div key={review.id} className="bg-white/5 rounded-2xl p-6 border border-white/5 space-y-4">
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-orange-500/10 text-orange-500 flex items-center justify-center text-[10px] font-bold">{review.userName.charAt(0)}</div>
                              <div>
                                <span className="text-xs font-bold text-gray-300 block">{review.userName}</span>
                                <span className="text-[10px] text-gray-600 font-mono">{new Date(review.createdAt).toLocaleDateString()}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex gap-0.5">
                                {[1,2,3,4,5].map(i => (
                                  <Star key={i} className={`w-2.5 h-2.5 ${i <= review.rating ? 'text-orange-500 fill-current' : 'text-gray-800'}`} />
                                ))}
                              </div>
                              {(user.uid === review.userId || user.email === 'kwoncho1001@gmail.com') && (
                                <div className="flex gap-2">
                                  <button onClick={() => startEditReview(review)} className="text-gray-600 hover:text-blue-500"><Edit2 className="w-3 h-3" /></button>
                                  <button onClick={() => handleDeleteReview(review.id!)} className="text-gray-600 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center border-t border-white/5 pt-4">
                            <TastingRadar note={review} />
                            <p className="text-xs text-gray-400 leading-relaxed italic">"{review.note}"</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-12 border border-dashed border-white/5 rounded-2xl text-[10px] text-gray-600 italic">No notes yet.</div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
