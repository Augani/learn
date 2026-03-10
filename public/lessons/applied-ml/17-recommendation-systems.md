# Lesson 17: Recommendation Systems

## The Netflix Problem

Netflix, Spotify, and Amazon all solve the same problem:
given millions of items and millions of users, which items
should THIS user see next? Like a friend who knows your
taste perfectly and always has great suggestions.

```
  THE SCALE OF THE PROBLEM
  ========================

  Users:    500,000,000
  Items:    50,000
  Possible pairs: 25,000,000,000,000

  Each user has rated maybe 200 items.
  That's 0.0004% of the matrix filled in.
  99.9996% is MISSING.

  ┌──────────────────────────────────────────┐
  │         Movie1  Movie2  Movie3  Movie4   │
  │  User1:   5       ?       3       ?      │
  │  User2:   ?       4       ?       2      │
  │  User3:   4       ?       ?       ?      │
  │  User4:   ?       3       5       ?      │
  │                                          │
  │  ? = your job is to predict these        │
  └──────────────────────────────────────────┘
```

---

## Two Main Approaches

```
  COLLABORATIVE FILTERING          CONTENT-BASED
  =========================        =========================

  "Users like you liked X"         "You liked action movies,
                                    here's another action movie"

  Uses: user-item interactions     Uses: item features/attributes
  No item features needed          No other users needed

  Cold start problem: YES          Cold start problem: partial
  (new users/items have no data)   (new items ok, new users hard)

  ┌──────────┐                     ┌──────────┐
  │  Users   │ --- ratings --->    │  Items   │
  │  (who)   │ --- purchases -->   │ features │
  │  (what)  │ --- clicks ---->    │ (genre,  │
  └──────────┘                     │  actor,  │
  Find similar users               │  length) │
  or similar items                 └──────────┘
                                   Match user profile to items
```

---

## Collaborative Filtering: User-Based

```python
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

ratings = np.array([
    [5, 3, 0, 1, 4],
    [4, 0, 0, 1, 3],
    [1, 1, 0, 5, 0],
    [0, 0, 5, 4, 0],
    [0, 1, 4, 4, 0],
])

items = ["Action1", "Action2", "Drama1", "Drama2", "Action3"]
users = ["Alice", "Bob", "Carol", "Dave", "Eve"]

mask = (ratings > 0).astype(float)
row_means = np.where(mask.sum(axis=1, keepdims=True) > 0,
                     (ratings * mask).sum(axis=1, keepdims=True) / mask.sum(axis=1, keepdims=True),
                     0)
normalized = np.where(mask > 0, ratings - row_means, 0)

similarity = cosine_similarity(normalized)
np.fill_diagonal(similarity, 0)

def predict_rating(user_idx, item_idx, ratings, similarity, k=3):
    if ratings[user_idx, item_idx] > 0:
        return ratings[user_idx, item_idx]

    sim_scores = similarity[user_idx]
    rated_mask = ratings[:, item_idx] > 0
    valid = sim_scores * rated_mask

    top_k_idx = np.argsort(valid)[-k:]
    top_k_idx = top_k_idx[valid[top_k_idx] > 0]

    if len(top_k_idx) == 0:
        return row_means[user_idx, 0]

    weights = similarity[user_idx, top_k_idx]
    weighted_ratings = ratings[top_k_idx, item_idx] * weights
    return weighted_ratings.sum() / (np.abs(weights).sum() + 1e-10)

user_idx = 1
print(f"Recommendations for {users[user_idx]}:")
for item_idx in range(len(items)):
    if ratings[user_idx, item_idx] == 0:
        pred = predict_rating(user_idx, item_idx, ratings, similarity)
        print(f"  {items[item_idx]}: predicted rating = {pred:.2f}")
```

---

## Matrix Factorization (SVD)

```
  THE BIG IDEA
  ============

  Decompose the user-item matrix into two smaller matrices:

  R (users x items) ≈ U (users x k) @ V (k x items)

  k = number of latent factors (e.g., 50)

  ┌──────────────┐     ┌────────┐   ┌──────────────┐
  │ Users x Items │  =  │Users x k│ @ │ k x Items    │
  │  (sparse)     │     │(user    │   │ (item        │
  │  500M x 50K   │     │ tastes) │   │  properties) │
  └──────────────┘     └────────┘   └──────────────┘

  Factor 1 might represent "action vs drama preference"
  Factor 2 might represent "mainstream vs indie preference"
  etc.
```

```python
import numpy as np
from scipy.sparse.linalg import svds

ratings = np.array([
    [5, 3, 0, 1, 4],
    [4, 0, 0, 1, 3],
    [1, 1, 0, 5, 0],
    [0, 0, 5, 4, 0],
    [0, 1, 4, 4, 0],
], dtype=float)

items = ["Action1", "Action2", "Drama1", "Drama2", "Action3"]
users = ["Alice", "Bob", "Carol", "Dave", "Eve"]

user_means = ratings.sum(axis=1) / (ratings > 0).sum(axis=1)
ratings_centered = ratings.copy()
for i in range(len(users)):
    mask = ratings[i] > 0
    ratings_centered[i, mask] -= user_means[i]
    ratings_centered[i, ~mask] = 0

k = 3
U, sigma, Vt = svds(ratings_centered, k=k)

sigma_diag = np.diag(sigma)
predicted = U @ sigma_diag @ Vt

predicted_ratings = predicted + user_means.reshape(-1, 1)
predicted_ratings = np.clip(predicted_ratings, 1, 5)

user_idx = 1
print(f"\nRecommendations for {users[user_idx]}:")
unrated = np.where(ratings[user_idx] == 0)[0]
for item_idx in unrated:
    print(f"  {items[item_idx]}: predicted = {predicted_ratings[user_idx, item_idx]:.2f}")
```

---

## Content-Based Filtering

```python
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

items = [
    {"title": "Die Hard", "genre": "action thriller", "desc": "cop fights terrorists in a skyscraper"},
    {"title": "Speed", "genre": "action thriller", "desc": "bus must stay above 50mph or it explodes"},
    {"title": "Titanic", "genre": "romance drama", "desc": "love story on a doomed ocean liner"},
    {"title": "Notebook", "genre": "romance drama", "desc": "summer love story across decades"},
    {"title": "Matrix", "genre": "action sci-fi", "desc": "hacker discovers reality is simulated"},
    {"title": "Inception", "genre": "action sci-fi", "desc": "thief enters dreams to steal secrets"},
]

texts = [f"{item['genre']} {item['desc']}" for item in items]
tfidf = TfidfVectorizer(stop_words="english")
item_vectors = tfidf.fit_transform(texts)

similarity = cosine_similarity(item_vectors)

def recommend_similar(item_idx, top_n=3):
    scores = similarity[item_idx]
    ranked = np.argsort(scores)[::-1][1:top_n + 1]
    return [(items[i]["title"], scores[i]) for i in ranked]

print("If you liked 'Die Hard':")
for title, score in recommend_similar(0):
    print(f"  {title}: similarity = {score:.3f}")

print("\nIf you liked 'Titanic':")
for title, score in recommend_similar(2):
    print(f"  {title}: similarity = {score:.3f}")
```

---

## Hybrid Approaches

```
  COMBINING METHODS
  =================

  ┌──────────────┐     ┌──────────────┐
  │ Collaborative│     │ Content-Based│
  │  Filtering   │     │  Filtering   │
  └──────┬───────┘     └──────┬───────┘
         │                     │
         └────────┬────────────┘
                  v
         ┌──────────────┐
         │   Combine    │
         │  predictions │
         └──────┬───────┘
                v
         Final Recommendation

  COMBINATION STRATEGIES:
  1. Weighted average: 0.6 * CF + 0.4 * CB
  2. Switching: use CB for new items, CF for established
  3. Feature augmentation: use CB features in CF model
  4. Stacking: meta-model combines both predictions
```

---

## Evaluation Metrics

```
  ┌────────────────┬─────────────────────────────────────┐
  │ Metric         │ What It Measures                    │
  ├────────────────┼─────────────────────────────────────┤
  │ RMSE           │ Rating prediction accuracy           │
  │ MAE            │ Rating prediction accuracy (robust)  │
  │ Precision@k    │ Of top-k recommendations, how many   │
  │                │ were relevant?                       │
  │ Recall@k       │ Of all relevant items, how many      │
  │                │ were in top-k?                       │
  │ NDCG@k         │ Quality of ranking (position-aware)  │
  │ MAP            │ Average precision across queries     │
  │ Hit Rate       │ Did the user interact with any       │
  │                │ recommended item?                    │
  │ Coverage       │ What % of items ever get recommended?│
  │ Diversity      │ How different are the recommendations?│
  └────────────────┴─────────────────────────────────────┘
```

---

## The Cold Start Problem

```
  NEW USER: No interaction history. What to recommend?
  -> Show popular items
  -> Ask for preferences (onboarding quiz)
  -> Use demographic similarity

  NEW ITEM: No one has interacted with it yet.
  -> Use content-based features
  -> Show to exploration cohort
  -> Boost new items temporarily

  ┌─────────────────────────────────────────────┐
  │  Cold start is the #1 practical challenge   │
  │  in recommendation systems.                 │
  │  Your solution determines user retention.   │
  └─────────────────────────────────────────────┘
```

---

## Exercises

**Exercise 1:** Build a user-based collaborative filter on the
MovieLens 100K dataset. Implement k-nearest-neighbors prediction.
Evaluate with RMSE on a held-out test set.

**Exercise 2:** Implement matrix factorization using SVD on the
same dataset. Compare RMSE with the user-based approach.

**Exercise 3:** Build a content-based recommender using movie genres
and plot descriptions. Use TF-IDF + cosine similarity. Test by
finding similar movies to 5 popular films.

**Exercise 4:** Implement a hybrid system that combines collaborative
and content-based predictions. Use a weighted average. Find the
optimal weight using validation data.

**Exercise 5:** Address the cold start problem. Simulate 50 new users
with no history. Compare 3 strategies: random, popularity-based,
and content-based (using stated genre preferences). Measure hit
rate after the user rates 10 items.

---

[Next: Lesson 18 - End-to-End Project -->](18-end-to-end-project.md)
