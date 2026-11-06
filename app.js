// API Configuration
const API_KEY = '631e3c82fd16ffa992d3b7301f111354'; 
const API_BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/';
const POSTER_SIZE = 'w500';

// DOM elements
const trendingMoviesEl = document.getElementById('trending-movies');
const recommendedMoviesEl = document.getElementById('recommended-movies');
const trendingSeriesEl = document.getElementById('trending-series');
const recommendedSeriesEl = document.getElementById('recommended-series');
const searchInputEl = document.getElementById('search-input');
const searchBtnEl = document.getElementById('search-btn');
const searchResultsEl = document.getElementById('search-results');
const watchlistMoviesEl = document.getElementById('watchlist-movies');
const genreFiltersEl = document.getElementById('genre-filters');
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const movieDetailsContentEl = document.getElementById('movie-details-content');
const trailerModalEl = document.getElementById('trailer-modal');
const trailerContainerEl = document.getElementById('trailer-container');
const trailerListEl = document.getElementById('trailer-list');
const trailerTitleEl = document.getElementById('trailer-title');

// Sections
const homeSection = document.getElementById('home-section');
const movieDetailsSection = document.getElementById('movie-details-section');
const searchResultsSection = document.getElementById('search-results-section');
const watchlistSection = document.getElementById('watchlist-section');
const seriesSection = document.getElementById('series-section');

// Navigation
const navLinks = document.querySelectorAll('[data-nav]');

// State
let currentGenres = [];
let allMovies = []; // Store all movies for filtering
let allSeries = []; // Store all series for filtering
let watchlist = JSON.parse(localStorage.getItem('watchlist')) || [];
let seriesWatchlist = JSON.parse(localStorage.getItem('seriesWatchlist')) || [];
let currentPage = 1;
let isLoadingMore = false;

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', init);

async function init() {
  console.log("Initializing AdeFlix...");
  
  try {
    // Validate DOM elements
    if (!trendingMoviesEl || !recommendedMoviesEl) {
      throw new Error("Critical elements missing");
    }

    // Show loading states
    showLoading(trendingMoviesEl);
    showLoading(recommendedMoviesEl);

    // Setup UI and event listeners
    showSection(homeSection);
    setupEventListeners();

    // Load data with fallback
    const [genres, trendingMovies, popularMovies, trendingSeries, popularSeries] = await Promise.all([
      fetchGenres().catch(() => []),
      fetchTrendingMovies().catch(() => getFallbackMovies()),
      fetchPopularMovies().catch(() => getFallbackMovies()),
      fetchTrendingSeries().catch(() => getFallbackSeries()),
      fetchPopularSeries().catch(() => getFallbackSeries())
    ]);

    // Store all movies and series for filtering
    allMovies = [...trendingMovies, ...popularMovies];
    allSeries = [...trendingSeries, ...popularSeries];

    // Render content
    currentGenres = genres;
    populateGenreFilters(genres);
    renderMovies(trendingMoviesEl, trendingMovies);
    renderMovies(recommendedMoviesEl, popularMovies);
    renderSeries(trendingSeriesEl, trendingSeries);
    renderSeries(recommendedSeriesEl, popularSeries);
    renderWatchlist();

  } catch (error) {
    console.error("Initialization failed:", error);
    showError("Content loading failed - showing demo data");
    const fallbackMovies = getFallbackMovies();
    allMovies = fallbackMovies;
    renderMovies(trendingMoviesEl, fallbackMovies);
    renderMovies(recommendedMoviesEl, fallbackMovies);
  }
}

// API Functions
async function fetchFromAPI(endpoint, params = {}) {
  const url = `${API_BASE_URL}${endpoint}?${new URLSearchParams({
    api_key: API_KEY,
    language: 'en-US',
    ...params
  })}`;

  const response = await fetch(url);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.status_message || `HTTP ${response.status}: ${response.statusText}`);
  }
  return await response.json();
}

async function fetchTrendingMovies() {
  const data = await fetchFromAPI('/trending/movie/day');
  return data.results || [];
}

async function fetchPopularMovies(page = 1) {
  const data = await fetchFromAPI('/movie/popular', { page });
  return data.results || [];
}

async function loadMoreMovies() {
  if (isLoadingMore) return;
  
  const loadMoreBtn = document.getElementById('load-more-movies');
  if (!loadMoreBtn) return;
  
  isLoadingMore = true;
  loadMoreBtn.classList.add('loading');
  loadMoreBtn.innerHTML = '<i class="fas fa-spinner"></i> Loading...';
  loadMoreBtn.disabled = true;
  
  try {
    currentPage++;
    const newMovies = await fetchPopularMovies(currentPage);
    
    if (newMovies.length > 0) {
      // Add new movies to the existing array
      allMovies = [...allMovies, ...newMovies];
      
      recommendedMoviesEl.insertAdjacentHTML('beforeend', newMovies.map(movie => mediaCardHTML(movie, 'movie')).join(''));
      bindCards(recommendedMoviesEl, card => showMovieDetails(card.dataset.id));
      
      showSuccess(`Loaded ${newMovies.length} more movies!`);
    } else {
      loadMoreBtn.innerHTML = '<i class="fas fa-check"></i> No More Movies';
      loadMoreBtn.disabled = true;
    }
  } catch (error) {
    console.error("Failed to load more movies:", error);
    showError("Failed to load more movies");
    currentPage--; // Revert page number on error
  } finally {
    isLoadingMore = false;
    loadMoreBtn.classList.remove('loading');
    if (!loadMoreBtn.disabled) {
      loadMoreBtn.innerHTML = '<i class="fas fa-plus"></i> Load More Movies';
      loadMoreBtn.disabled = false;
    }
  }
}

async function fetchGenres() {
  const data = await fetchFromAPI('/genre/movie/list');
  return data.genres || [];
}

async function searchMovies(query) {
  const data = await fetchFromAPI('/search/movie', { query });
  return data.results || [];
}

async function fetchMoviesByGenre(genreId) {
  const data = await fetchFromAPI('/discover/movie', { with_genres: genreId });
  return data.results || [];
}

// Series API Functions
async function fetchTrendingSeries() {
  const data = await fetchFromAPI('/trending/tv/day');
  return data.results || [];
}

async function fetchPopularSeries() {
  const data = await fetchFromAPI('/tv/popular');
  return data.results || [];
}

async function searchSeries(query) {
  const data = await fetchFromAPI('/search/tv', { query });
  return data.results || [];
}

async function fetchSeriesByGenre(genreId) {
  const data = await fetchFromAPI('/discover/tv', { with_genres: genreId });
  return data.results || [];
}

// Trailer API Functions
async function fetchMovieTrailers(movieId) {
  const data = await fetchFromAPI(`/movie/${movieId}/videos`);
  return data.results?.filter(video => video.type === 'Trailer' && video.site === 'YouTube') || [];
}

async function fetchSeriesTrailers(seriesId) {
  const data = await fetchFromAPI(`/tv/${seriesId}/videos`);
  return data.results?.filter(video => video.type === 'Trailer' && video.site === 'YouTube') || [];
}

// Genre Functions
function populateGenreFilters(genres) {
  if (!genreFiltersEl || !genres.length) return;

  // Add "All" option
  const allOption = document.createElement('button');
  allOption.className = 'genre-btn active';
  allOption.textContent = 'All';
  allOption.dataset.genreId = '';
  genreFiltersEl.appendChild(allOption);

  // Add genre options
  genres.forEach(genre => {
    const button = document.createElement('button');
    button.className = 'genre-btn';
    button.textContent = genre.name;
    button.dataset.genreId = genre.id;
    genreFiltersEl.appendChild(button);
  });

  // Add event listeners
  genreFiltersEl.addEventListener('click', handleGenreFilter);
}

async function handleGenreFilter(e) {
  if (!e.target.classList.contains('genre-btn')) return;

  // Update active state
  genreFiltersEl.querySelectorAll('.genre-btn').forEach(btn => 
    btn.classList.remove('active'));
  e.target.classList.add('active');

  const genreId = e.target.dataset.genreId;
  const currentSection = document.querySelector('.active-section') || homeSection;

  try {
    if (currentSection === seriesSection) {
      // Filter series
      showLoading(trendingSeriesEl);
      showLoading(recommendedSeriesEl);

      if (genreId === '') {
        // Show all series
        const [trendingSeries, popularSeries] = await Promise.all([
          fetchTrendingSeries(),
          fetchPopularSeries()
        ]);
        renderSeries(trendingSeriesEl, trendingSeries);
        renderSeries(recommendedSeriesEl, popularSeries);
      } else {
        // Filter by genre
        const series = await fetchSeriesByGenre(genreId);
        renderSeries(trendingSeriesEl, series.slice(0, 10));
        renderSeries(recommendedSeriesEl, series.slice(10, 20));
      }
    } else {
      // Filter movies (existing logic)
      showLoading(trendingMoviesEl);
      showLoading(recommendedMoviesEl);

      if (genreId === '') {
        // Show all movies
        const [trendingMovies, popularMovies] = await Promise.all([
          fetchTrendingMovies(),
          fetchPopularMovies()
        ]);
        renderMovies(trendingMoviesEl, trendingMovies);
        renderMovies(recommendedMoviesEl, popularMovies);
      } else {
        // Filter by genre
        const movies = await fetchMoviesByGenre(genreId);
        renderMovies(trendingMoviesEl, movies.slice(0, 10));
        renderMovies(recommendedMoviesEl, movies.slice(10, 20));
      }
    }
  } catch (error) {
    console.error("Genre filtering failed:", error);
    showError("Failed to filter by genre");
  }
}

// UI Functions
function genreLabel(item) {
  const ids = item?.genre_ids || [];
  if (!ids.length || !currentGenres.length) return '';
  const match = currentGenres.find(genre => genre.id === ids[0]);
  return match ? match.name : '';
}

function mediaCardHTML(item, type, options = {}) {
  const title = item.title || item.name || 'Untitled';
  const year = (item.release_date || item.first_air_date || '').substring(0, 4) || 'N/A';
  const genre = genreLabel(item);
  const blurb = (item.overview || '').trim().slice(0, 110);
  const badge = options.badge
    ? `<span class="type-badge">${type === 'series' ? 'Series' : 'Movie'}</span>`
    : '';
  const action = options.removable
    ? `<div class="remove-overlay">
         <button type="button" class="remove-btn" aria-label="Remove from watchlist" onclick="removeFromWatchlist(${Number(item.id)}, '${type}')">
           <i class="fas fa-times"></i>
         </button>
       </div>`
    : `<span class="card-play" aria-hidden="true"><i class="fas fa-play"></i></span>`;

  return `
    <article class="movie-card" data-id="${item.id}" data-type="${type}">
      <div class="movie-poster">
        <img src="${getImageUrl(item.poster_path)}" alt="${escapeHtml(title)}" loading="lazy" onerror="handleImageError(this)">
        ${genre ? `<span class="card-genre">${escapeHtml(genre)}</span>` : ''}
        ${options.removable ? action : ''}
      </div>
      <div class="movie-info">
        <h3>${escapeHtml(title)}</h3>
        ${blurb ? `<p class="card-overview">${escapeHtml(blurb)}</p>` : ''}
        <div class="movie-meta">
          ${badge}
          <span>${year}</span>
          <span class="rating"><i class="fas fa-star"></i> ${item.vote_average?.toFixed(1) || 'N/A'}</span>
        </div>
      </div>
      ${options.removable ? '' : action}
    </article>
  `;
}

function bindCards(container, handler) {
  container.querySelectorAll('.movie-card:not([data-initialized])').forEach(card => {
    card.setAttribute('data-initialized', 'true');
    card.addEventListener('click', event => {
      if (event.target.closest('.remove-btn')) return;
      handler(card);
    });
  });
}

function renderFeatured(container, item, type) {
  if (!container) return;
  if (!item) {
    container.innerHTML = `
      <div class="hero-copy">
        <div class="hero-kicker"><i class="fas fa-fire"></i> Now trending</div>
        <h2>Nothing to feature</h2>
        <p>Try another genre or check back later.</p>
      </div>
    `;
    return;
  }

  const title = item.title || item.name || 'Untitled';
  const year = (item.release_date || item.first_air_date || '').substring(0, 4);
  const genre = genreLabel(item);
  const rating = item.vote_average?.toFixed(1) || 'N/A';
  const image = item.backdrop_path
    ? `${IMAGE_BASE_URL}w1280${item.backdrop_path}`
    : getImageUrl(item.poster_path);

  container.innerHTML = `
    <div class="hero-copy">
      <div class="hero-kicker"><i class="fas fa-fire"></i> Now trending</div>
      <div class="hero-tags">
        ${genre ? `<span>${escapeHtml(genre)}</span>` : ''}
        ${year ? `<span>${year}</span>` : ''}
        <span class="rating"><i class="fas fa-star"></i> ${rating}</span>
      </div>
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(item.overview || 'No overview available.')}</p>
      <div class="hero-actions">
        <button type="button" class="btn btn-primary" data-hero="open"><i class="fas fa-play"></i> Watch</button>
        <button type="button" class="btn btn-ghost" data-hero="trailer"><i class="fas fa-film"></i> Trailer</button>
        <button type="button" class="btn btn-icon" data-hero="save" aria-label="Save to watchlist"><i class="fas fa-bookmark"></i></button>
      </div>
    </div>
    <div class="hero-media">
      <img src="${image}" alt="${escapeHtml(title)}" onerror="handleImageError(this)">
    </div>
  `;

  container.querySelector('[data-hero="open"]').addEventListener('click', () => {
    if (type === 'series') showSeriesDetails(item.id);
    else showMovieDetails(item.id);
  });
  container.querySelector('[data-hero="trailer"]').addEventListener('click', () => {
    showTrailer(item.id, type === 'series' ? 'series' : 'movie');
  });
  container.querySelector('[data-hero="save"]').addEventListener('click', () => {
    if (type === 'series') addSeriesToWatchlist(item);
    else addToWatchlist(item);
  });
}

function renderMovies(container, movies) {
  if (!container) return;
  
  if (!movies?.length) {
    container.innerHTML = '<p class="no-results">No movies found</p>';
    if (container === trendingMoviesEl) renderFeatured(document.getElementById('featured-hero'), null, 'movie');
    return;
  }

  const visibleMovies = container === trendingMoviesEl ? movies.slice(0, 5) : movies;
  container.innerHTML = visibleMovies.map(movie => mediaCardHTML(movie, 'movie')).join('');
  bindCards(container, card => showMovieDetails(card.dataset.id));
  if (container === trendingMoviesEl) renderFeatured(document.getElementById('featured-hero'), movies[0], 'movie');
}

function renderSeries(container, series) {
  if (!container) return;
  
  if (!series?.length) {
    container.innerHTML = '<p class="no-results">No series found</p>';
    if (container === trendingSeriesEl) renderFeatured(document.getElementById('series-hero'), null, 'series');
    return;
  }

  const visibleSeries = container === trendingSeriesEl ? series.slice(0, 5) : series;
  container.innerHTML = visibleSeries.map(show => mediaCardHTML(show, 'series')).join('');
  bindCards(container, card => showSeriesDetails(card.dataset.id));
  if (container === trendingSeriesEl) renderFeatured(document.getElementById('series-hero'), series[0], 'series');
}

function getImageUrl(posterPath) {
  if (!posterPath) return 'https://via.placeholder.com/300x450/333333/ffffff?text=No+Image';
  return `${IMAGE_BASE_URL}${POSTER_SIZE}${posterPath}`;
}

function handleImageError(img) {
  if (!img.dataset.fallbackAttempted) {
    img.dataset.fallbackAttempted = 'true';
    img.src = 'https://via.placeholder.com/300x450/333333/ffffff?text=Image+Not+Found';
  }
}

function showMovieDetails(movieId) {
  showLoading(movieDetailsContentEl);
  showSection(movieDetailsSection);

  fetchFromAPI(`/movie/${movieId}`)
    .then(movie => {
      const isInWatchlist = watchlist.some(m => m.id === movie.id);
      
      movieDetailsContentEl.innerHTML = `
        <div class="movie-details">
          <div class="movie-backdrop">
            <img src="${movie.backdrop_path ? 
              `${IMAGE_BASE_URL}original${movie.backdrop_path}` : 
              'https://via.placeholder.com/1200x500/333333/ffffff?text=No+Backdrop'}" 
              alt="${escapeHtml(movie.title)}"
              onerror="this.src='https://via.placeholder.com/1200x500/333333/ffffff?text=Image+Not+Found'">
          </div>
          <div class="details-content">
            <h2>${escapeHtml(movie.title)}</h2>
            <div class="movie-info-details">
              <span class="release-date">${movie.release_date || 'N/A'}</span>
              <span class="runtime">${movie.runtime ? movie.runtime + ' min' : 'N/A'}</span>
              <span class="rating">
                <i class="fas fa-star"></i>
                ${movie.vote_average?.toFixed(1) || 'N/A'}
              </span>
            </div>
            <div class="genres">
              ${movie.genres?.map(g => `<span class="genre-tag">${g.name}</span>`).join('') || ''}
            </div>
            <p class="overview">${escapeHtml(movie.overview || 'No overview available')}</p>
            <div class="action-buttons">
              <button id="add-to-watchlist" class="btn ${isInWatchlist ? 'btn-secondary' : 'btn-primary'}" 
                      data-movie='${JSON.stringify(movie)}'>
                <i class="fas ${isInWatchlist ? 'fa-check' : 'fa-plus'}"></i>
                ${isInWatchlist ? 'In Watchlist' : 'Add to Watchlist'}
              </button>
              ${isInWatchlist ? `
                <button id="remove-from-watchlist" class="btn btn-danger" data-movie-id="${movie.id}">
                  <i class="fas fa-minus"></i>
                  Remove from Watchlist
                </button>
              ` : ''}
              <button id="watch-trailer" class="btn btn-outline" data-movie-id="${movie.id}">
                <i class="fas fa-play"></i>
                Watch Trailer
              </button>
              <button id="back-btn" class="btn btn-outline">
                <i class="fas fa-arrow-left"></i>
                Back
              </button>
            </div>
          </div>
        </div>
      `;

      // Add event listeners
      const addToWatchlistBtn = document.getElementById('add-to-watchlist');
      const removeFromWatchlistBtn = document.getElementById('remove-from-watchlist');
      const watchTrailerBtn = document.getElementById('watch-trailer');
      const backBtn = document.getElementById('back-btn');

      if (addToWatchlistBtn && !isInWatchlist) {
        addToWatchlistBtn.addEventListener('click', () => {
          addToWatchlist(movie);
          addToWatchlistBtn.innerHTML = '<i class="fas fa-check"></i> In Watchlist';
          addToWatchlistBtn.className = 'btn btn-secondary';
          addToWatchlistBtn.disabled = true;
        });
      }

      if (removeFromWatchlistBtn && isInWatchlist) {
        removeFromWatchlistBtn.addEventListener('click', () => {
          removeFromWatchlist(movie.id, 'movie');
          removeFromWatchlistBtn.remove();
        });
      }

      if (watchTrailerBtn) {
        watchTrailerBtn.addEventListener('click', () => showTrailer(movie.id));
      }

      if (backBtn) {
        backBtn.addEventListener('click', () => showSection(homeSection));
      }
    })
    .catch(error => {
      console.error("Failed to load movie details:", error);
      movieDetailsContentEl.innerHTML = `
        <div class="error-container">
          <p class="error">Failed to load movie details: ${error.message}</p>
          <button type="button" class="btn btn-primary" data-go="home">Back to Home</button>
        </div>
      `;
    });
}

function showSeriesDetails(seriesId) {
  showLoading(movieDetailsContentEl);
  showSection(movieDetailsSection);

  fetchFromAPI(`/tv/${seriesId}`)
    .then(series => {
      const isInWatchlist = seriesWatchlist.some(s => s.id === series.id);
      
      movieDetailsContentEl.innerHTML = `
        <div class="movie-details">
          <div class="movie-backdrop">
            <img src="${series.backdrop_path ? 
              `${IMAGE_BASE_URL}original${series.backdrop_path}` : 
              'https://via.placeholder.com/1200x500/333333/ffffff?text=No+Backdrop'}" 
              alt="${escapeHtml(series.name)}"
              onerror="this.src='https://via.placeholder.com/1200x500/333333/ffffff?text=Image+Not+Found'">
          </div>
          <div class="details-content">
            <h2>${escapeHtml(series.name)}</h2>
            <div class="movie-info-details">
              <span class="release-date">${series.first_air_date || 'N/A'}</span>
              <span class="seasons">${series.number_of_seasons ? series.number_of_seasons + ' Season(s)' : 'N/A'}</span>
              <span class="rating">
                <i class="fas fa-star"></i>
                ${series.vote_average?.toFixed(1) || 'N/A'}
              </span>
            </div>
            <div class="genres">
              ${series.genres?.map(g => `<span class="genre-tag">${g.name}</span>`).join('') || ''}
            </div>
            <p class="overview">${escapeHtml(series.overview || 'No overview available')}</p>
            <div class="action-buttons">
              <button id="add-to-watchlist" class="btn ${isInWatchlist ? 'btn-secondary' : 'btn-primary'}" 
                      data-series='${JSON.stringify(series)}'>
                <i class="fas ${isInWatchlist ? 'fa-check' : 'fa-plus'}"></i>
                ${isInWatchlist ? 'In Watchlist' : 'Add to Watchlist'}
              </button>
              ${isInWatchlist ? `
                <button id="remove-from-watchlist" class="btn btn-danger" data-series-id="${series.id}">
                  <i class="fas fa-minus"></i>
                  Remove from Watchlist
                </button>
              ` : ''}
              <button id="watch-trailer" class="btn btn-outline" data-series-id="${series.id}">
                <i class="fas fa-play"></i>
                Watch Trailer
              </button>
              <button id="back-btn" class="btn btn-outline">
                <i class="fas fa-arrow-left"></i>
                Back
              </button>
            </div>
          </div>
        </div>
      `;

      // Add event listeners
      const addToWatchlistBtn = document.getElementById('add-to-watchlist');
      const removeFromWatchlistBtn = document.getElementById('remove-from-watchlist');
      const watchTrailerBtn = document.getElementById('watch-trailer');
      const backBtn = document.getElementById('back-btn');

      if (addToWatchlistBtn && !isInWatchlist) {
        addToWatchlistBtn.addEventListener('click', () => {
          addSeriesToWatchlist(series);
          addToWatchlistBtn.innerHTML = '<i class="fas fa-check"></i> In Watchlist';
          addToWatchlistBtn.className = 'btn btn-secondary';
          addToWatchlistBtn.disabled = true;
        });
      }

      if (removeFromWatchlistBtn && isInWatchlist) {
        removeFromWatchlistBtn.addEventListener('click', () => {
          removeFromWatchlist(series.id, 'series');
          removeFromWatchlistBtn.remove();
        });
      }

      if (watchTrailerBtn) {
        watchTrailerBtn.addEventListener('click', () => showTrailer(series.id, 'series'));
      }

      if (backBtn) {
        backBtn.addEventListener('click', () => showSection(seriesSection));
      }
    })
    .catch(error => {
      console.error("Failed to load series details:", error);
      movieDetailsContentEl.innerHTML = `
        <div class="error-container">
          <p class="error">Failed to load series details: ${error.message}</p>
          <button type="button" class="btn btn-primary" data-go="series">Back to Series</button>
        </div>
      `;
    });
}

// Search Functionality
function handleSearch() {
  const query = searchInputEl.value.trim();
  if (!query) return;

  showLoading(searchResultsEl);
  showSection(searchResultsSection);

  // Search for both movies and series
  Promise.all([
    searchMovies(query),
    searchSeries(query)
  ])
    .then(([movies, series]) => {
      const allResults = [
        ...movies.map(m => ({ ...m, type: 'movie' })),
        ...series.map(s => ({ ...s, type: 'series', title: s.name }))
      ];
      
      renderSearchResults(searchResultsEl, allResults);
      const heading = document.getElementById('search-heading');
      if (heading) heading.textContent = `Results for "${query}" (${allResults.length})`;
    })
    .catch(error => {
      console.error("Search failed:", error);
      searchResultsEl.innerHTML = `
        <div class="error-container">
          <p class="error">Search failed: ${error.message}</p>
          <button type="button" class="btn btn-primary" data-go="search">Try Again</button>
        </div>
      `;
    });
}

function renderSearchResults(container, results) {
  if (!container) return;
  
  if (!results?.length) {
    container.innerHTML = '<p class="no-results">No results found</p>';
    return;
  }

  container.innerHTML = results.map(item => mediaCardHTML(item, item.type, { badge: true })).join('');
  bindCards(container, card => {
    if (card.dataset.type === 'series') showSeriesDetails(card.dataset.id);
    else showMovieDetails(card.dataset.id);
  });
}

// Watchlist Functions
function renderWatchlist() {
  if (!watchlistMoviesEl) return;

  const allWatchlistItems = [
    ...watchlist.map(item => ({ ...item, type: 'movie' })),
    ...seriesWatchlist.map(item => ({ ...item, type: 'series', title: item.name }))
  ];

  renderHomeSaved(allWatchlistItems);

  if (!allWatchlistItems.length) {
    watchlistMoviesEl.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-bookmark fa-3x"></i>
        <h3>Your watchlist is empty</h3>
        <p>Add movies and series to your watchlist to see them here</p>
        <button type="button" class="btn btn-primary" data-go="home">Browse Content</button>
      </div>
    `;
    return;
  }
  
  watchlistMoviesEl.innerHTML = allWatchlistItems.map(item => mediaCardHTML(item, item.type, { badge: true, removable: true })).join('');
  bindCards(watchlistMoviesEl, card => {
    if (card.dataset.type === 'series') showSeriesDetails(card.dataset.id);
    else showMovieDetails(card.dataset.id);
  });
}

function renderHomeSaved(items) {
  const homeSavedEl = document.getElementById('home-saved');
  const countEl = document.getElementById('watchlist-count');
  if (countEl) {
    countEl.textContent = String(items.length);
    countEl.classList.toggle('is-empty', items.length === 0);
  }
  if (!homeSavedEl) return;

  if (!items.length) {
    homeSavedEl.innerHTML = '<p class="mini-empty">Save a title and it will show up here.</p>';
    return;
  }

  homeSavedEl.innerHTML = items.slice(0, 4).map(item => `
    <button type="button" class="saved-item" data-id="${item.id}" data-type="${item.type}">
      <img src="${getImageUrl(item.poster_path)}" alt="" onerror="handleImageError(this)">
      <span>${escapeHtml(item.title || item.name)}</span>
    </button>
  `).join('');

  homeSavedEl.querySelectorAll('.saved-item').forEach(button => {
    button.addEventListener('click', () => {
      if (button.dataset.type === 'series') showSeriesDetails(button.dataset.id);
      else showMovieDetails(button.dataset.id);
    });
  });
}

function addToWatchlist(movie) {
  if (!watchlist.some(m => m.id === movie.id)) {
    // Create a clean movie object for storage
    const watchlistMovie = {
      id: movie.id,
      title: movie.title,
      poster_path: movie.poster_path,
      vote_average: movie.vote_average,
      release_date: movie.release_date,
      overview: movie.overview
    };
    
    watchlist.push(watchlistMovie);
    localStorage.setItem('watchlist', JSON.stringify(watchlist));
    renderWatchlist();
    showSuccess(`"${movie.title}" added to watchlist!`);
  }
}

function removeFromWatchlist(movieId, type) {
  let removedItem;
  
  if (type === 'movie') {
    removedItem = watchlist.find(m => m.id === movieId);
    watchlist = watchlist.filter(m => m.id !== movieId);
    localStorage.setItem('watchlist', JSON.stringify(watchlist));
  } else if (type === 'series') {
    removedItem = seriesWatchlist.find(s => s.id === movieId);
    seriesWatchlist = seriesWatchlist.filter(s => s.id !== movieId);
    localStorage.setItem('seriesWatchlist', JSON.stringify(seriesWatchlist));
  }
  
  renderWatchlist();
  
  if (removedItem) {
    const itemName = removedItem.title || removedItem.name;
    showSuccess(`"${itemName}" removed from watchlist!`);
  }
}

// Series Watchlist Functions
function addSeriesToWatchlist(series) {
  if (!seriesWatchlist.some(s => s.id === series.id)) {
    // Create a clean series object for storage
    const watchlistSeries = {
      id: series.id,
      name: series.name,
      poster_path: series.poster_path,
      vote_average: series.vote_average,
      first_air_date: series.first_air_date,
      overview: series.overview,
      number_of_seasons: series.number_of_seasons
    };
    
    seriesWatchlist.push(watchlistSeries);
    localStorage.setItem('seriesWatchlist', JSON.stringify(seriesWatchlist));
    renderWatchlist();
    showSuccess(`"${series.name}" added to watchlist!`);
  }
}

function removeSeriesFromWatchlist(seriesId) {
  seriesWatchlist = seriesWatchlist.filter(s => s.id !== seriesId);
  localStorage.setItem('seriesWatchlist', JSON.stringify(seriesWatchlist));
}

// Trailer Functions
async function showTrailer(id, type = 'movie') {
  try {
    showLoading(trailerContainerEl);
    trailerModalEl.classList.remove('hidden');
    
    const trailers = type === 'series' 
      ? await fetchSeriesTrailers(id)
      : await fetchMovieTrailers(id);
    
    if (!trailers.length) {
      trailerContainerEl.innerHTML = `
        <div class="no-trailer">
          <i class="fas fa-video-slash fa-3x"></i>
          <h3>No trailers available</h3>
          <p>Sorry, no trailers are currently available for this ${type}.</p>
        </div>
      `;
      trailerListEl.innerHTML = '';
      return;
    }
    
    // Set the first trailer as the main trailer
    const mainTrailer = trailers[0];
    const embedUrl = `https://www.youtube.com/embed/${mainTrailer.key}`;
    
    trailerContainerEl.innerHTML = `
      <div class="trailer-video">
        <iframe 
          src="${embedUrl}" 
          frameborder="0" 
          allowfullscreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture">
        </iframe>
      </div>
    `;
    
    // Update title
    trailerTitleEl.textContent = `${mainTrailer.name} - ${type === 'series' ? 'Series' : 'Movie'} Trailer`;
    
    // Show additional trailers if available
    if (trailers.length > 1) {
      trailerListEl.innerHTML = `
        <h4>More Trailers</h4>
        <div class="trailer-thumbnails">
          ${trailers.slice(1).map(trailer => `
            <div class="trailer-thumbnail" onclick="playTrailer('${trailer.key}', '${escapeHtml(trailer.name)}')">
              <img src="https://img.youtube.com/vi/${trailer.key}/mqdefault.jpg" 
                   alt="${escapeHtml(trailer.name)}"
                   onerror="this.src='https://via.placeholder.com/120x90/333333/ffffff?text=No+Thumbnail'">
              <div class="trailer-thumbnail-overlay">
                <i class="fas fa-play"></i>
              </div>
              <p>${escapeHtml(trailer.name)}</p>
            </div>
          `).join('')}
        </div>
      `;
    } else {
      trailerListEl.innerHTML = '';
    }
    
  } catch (error) {
    console.error("Failed to load trailers:", error);
    trailerContainerEl.innerHTML = `
      <div class="error-container">
        <p class="error">Failed to load trailers: ${error.message}</p>
        <button onclick="closeTrailerModal()" class="btn btn-primary">Close</button>
      </div>
    `;
  }
}

function playTrailer(videoKey, title) {
  const embedUrl = `https://www.youtube.com/embed/${videoKey}`;
  trailerContainerEl.innerHTML = `
    <div class="trailer-video">
      <iframe 
        src="${embedUrl}" 
        frameborder="0" 
        allowfullscreen
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture">
      </iframe>
    </div>
  `;
  trailerTitleEl.textContent = title;
}

function closeTrailerModal() {
  trailerModalEl.classList.add('hidden');
  trailerContainerEl.innerHTML = '';
  trailerListEl.innerHTML = '';
}

// Helper Functions
function showSection(section) {
  if (!section) return;
  
  [homeSection, movieDetailsSection, searchResultsSection, watchlistSection, seriesSection]
    .forEach(s => s?.classList.add('hidden'));
  section.classList.remove('hidden');

  let activeSectionName = '';
  if (section === homeSection) activeSectionName = 'movies';
  else if (section === watchlistSection) activeSectionName = 'watchlist';
  else if (section === seriesSection) activeSectionName = 'series';

  navLinks.forEach(link => {
    const isPrimary = link.classList.contains('rail-btn') || Boolean(link.closest('nav'));
    if (!isPrimary) return;
    link.classList.toggle('active', link.dataset.section === activeSectionName);
  });

  const genreBar = document.getElementById('genre-bar');
  if (genreBar) genreBar.classList.toggle('hidden', section !== homeSection && section !== seriesSection);
}

function showLoading(element) {
  if (!element) return;
  element.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i><p>Loading...</p></div>';
}

function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  errorDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
  document.body.prepend(errorDiv);
  setTimeout(() => errorDiv.remove(), 5000);
}

function showSuccess(message) {
  const successDiv = document.createElement('div');
  successDiv.className = 'success-message';
  successDiv.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
  document.body.prepend(successDiv);
  setTimeout(() => successDiv.remove(), 3000);
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getFallbackMovies() {
  return [
    {
      id: 1,
      title: "The Shawshank Redemption",
      poster_path: null,
      vote_average: 8.7,
      release_date: "1994-09-23",
      overview: "Two imprisoned men bond over several years, finding solace and eventual redemption through acts of common decency."
    },
    {
      id: 2,
      title: "The Godfather",
      poster_path: null,
      vote_average: 8.7,
      release_date: "1972-03-24",
      overview: "The aging patriarch of an organized crime dynasty transfers control of his clandestine empire to his reluctant son."
    },
    {
      id: 3,
      title: "The Dark Knight",
      poster_path: null,
      vote_average: 8.5,
      release_date: "2008-07-18",
      overview: "When the menace known as the Joker wreaks havoc and chaos on the people of Gotham, Batman must accept one of the greatest psychological and physical tests."
    }
  ];
}

function getFallbackSeries() {
  return [
    {
      id: 1,
      name: "Breaking Bad",
      poster_path: null,
      vote_average: 8.8,
      first_air_date: "2008-01-20",
      overview: "A high school chemistry teacher diagnosed with inoperable lung cancer turns to manufacturing and selling methamphetamine in order to secure his family's future."
    },
    {
      id: 2,
      name: "Game of Thrones",
      poster_path: null,
      vote_average: 8.4,
      first_air_date: "2011-04-17",
      overview: "Nine noble families fight for control over the mythical lands of Westeros."
    },
    {
      id: 3,
      name: "The Walking Dead",
      poster_path: null,
      vote_average: 7.4,
      first_air_date: "2010-10-31",
      overview: "Sheriff's deputy Rick Grimes wakes up from a coma to find a post-apocalyptic world dominated by flesh-eating zombies."
    }
  ];
}

// Event Listeners
function setupEventListeners() {
  // Search
  document.getElementById('search-form')?.addEventListener('submit', event => {
    event.preventDefault();
    handleSearch();
  });
  if (searchBtnEl) searchBtnEl.addEventListener('click', handleSearch);

  document.body.addEventListener('click', event => {
    const go = event.target.closest('[data-go]');
    if (!go) return;
    if (go.dataset.go === 'home') showSection(homeSection);
    else if (go.dataset.go === 'series') showSection(seriesSection);
    else if (go.dataset.go === 'search') handleSearch();
  });

  const navToggle = document.getElementById('nav-toggle');
  navToggle?.addEventListener('click', () => {
    const open = document.body.classList.toggle('nav-open');
    navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  document.getElementById('see-all-movies')?.addEventListener('click', () => {
    recommendedMoviesEl.classList.toggle('is-expanded');
    const expanded = recommendedMoviesEl.classList.contains('is-expanded');
    document.getElementById('see-all-movies').textContent = expanded ? 'Collapse' : 'See all';
  });

  // Navigation
  navLinks.forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      document.body.classList.remove('nav-open');
      navToggle?.setAttribute('aria-expanded', 'false');
      const section = link.dataset.section;
      
      if (section === 'movies') {
        showSection(homeSection);
      } else if (section === 'watchlist') {
        showSection(watchlistSection);
      } else if (section === 'series') {
        showSection(seriesSection);
      } else {
        showError('This section is coming soon!');
      }
    });
  });

  // Theme Toggle
  const themeButton = document.getElementById('theme-toggle') || themeToggleBtn;
  if (themeButton) {
    themeButton.addEventListener('click', toggleTheme);
    
    if (localStorage.getItem('darkTheme') === 'true') {
      document.body.classList.add('dark-theme');
      themeToggleBtn?.classList.remove('fa-moon');
      themeToggleBtn?.classList.add('fa-sun');
    }
  }

  // Global error handler
  window.addEventListener('error', e => {
    console.error('Global error:', e.error);
    showError('An unexpected error occurred');
  });

  // Handle image loading errors globally
  document.addEventListener('error', e => {
    if (e.target.tagName === 'IMG') {
      handleImageError(e.target);
    }
  }, true);

  // Trailer modal event listeners
  if (trailerModalEl) {
    trailerModalEl.addEventListener('click', e => {
      if (e.target === trailerModalEl) {
        closeTrailerModal();
      }
    });

    // Close modal with Escape key
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !trailerModalEl.classList.contains('hidden')) {
        closeTrailerModal();
      }
    });
  }

  // Load More Movies Button
  const loadMoreBtn = document.getElementById('load-more-movies');
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', loadMoreMovies);
  }
}

function toggleTheme() {
  document.body.classList.toggle('dark-theme');
  const isDark = document.body.classList.contains('dark-theme');
  
  if (themeToggleBtn) {
    themeToggleBtn.classList.toggle('fa-moon', !isDark);
    themeToggleBtn.classList.toggle('fa-sun', isDark);
  }
  
  localStorage.setItem('darkTheme', isDark);
}