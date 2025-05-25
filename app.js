// API Configuration
const API_KEY = '631e3c82fd16ffa992d3b7301f111354'; // Replace if needed
const API_BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/';
const POSTER_SIZE = 'w500';

// DOM elements
const trendingMoviesEl = document.getElementById('trending-movies');
const recommendedMoviesEl = document.getElementById('recommended-movies');
const searchInputEl = document.getElementById('search-input');
const searchBtnEl = document.getElementById('search-btn');
const searchResultsEl = document.getElementById('search-results');
const watchlistMoviesEl = document.getElementById('watchlist-movies');
const genreFiltersEl = document.getElementById('genre-filters');
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const movieDetailsContentEl = document.getElementById('movie-details-content');

// Sections
const homeSection = document.getElementById('home-section');
const movieDetailsSection = document.getElementById('movie-details-section');
const searchResultsSection = document.getElementById('search-results-section');
const watchlistSection = document.getElementById('watchlist-section');

// Navigation
const navLinks = document.querySelectorAll('nav ul li a');

// State
let currentGenres = [];
let allMovies = []; // Store all movies for filtering
let watchlist = JSON.parse(localStorage.getItem('watchlist')) || [];

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
    const [genres, trendingMovies, popularMovies] = await Promise.all([
      fetchGenres().catch(() => []),
      fetchTrendingMovies().catch(() => getFallbackMovies()),
      fetchPopularMovies().catch(() => getFallbackMovies())
    ]);

    // Store all movies for filtering
    allMovies = [...trendingMovies, ...popularMovies];

    // Render content
    populateGenreFilters(genres);
    renderMovies(trendingMoviesEl, trendingMovies);
    renderMovies(recommendedMoviesEl, popularMovies);
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

async function fetchPopularMovies() {
  const data = await fetchFromAPI('/movie/popular');
  return data.results || [];
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

  try {
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
  } catch (error) {
    console.error("Genre filtering failed:", error);
    showError("Failed to filter by genre");
  }
}

// UI Functions
function renderMovies(container, movies) {
  if (!container) return;
  
  if (!movies?.length) {
    container.innerHTML = '<p class="no-results">No movies found</p>';
    return;
  }

  container.innerHTML = movies.map(movie => `
    <div class="movie-card" data-id="${movie.id}">
      <div class="movie-poster">
        <img src="${getImageUrl(movie.poster_path)}" 
             alt="${movie.title}"
             loading="lazy"
             onerror="handleImageError(this)">
      </div>
      <div class="movie-info">
        <h3>${escapeHtml(movie.title)}</h3>
        <div class="movie-meta">
          <span>${movie.release_date?.substring(0, 4) || 'N/A'}</span>
          <span class="rating">
            <i class="fas fa-star"></i>
            ${movie.vote_average?.toFixed(1) || 'N/A'}
          </span>
        </div>
      </div>
    </div>
  `).join('');

  // Add click handlers
  container.querySelectorAll('.movie-card').forEach(card => {
    card.addEventListener('click', () => showMovieDetails(card.dataset.id));
  });
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
      const backBtn = document.getElementById('back-btn');

      if (addToWatchlistBtn && !isInWatchlist) {
        addToWatchlistBtn.addEventListener('click', () => {
          addToWatchlist(movie);
          addToWatchlistBtn.innerHTML = '<i class="fas fa-check"></i> In Watchlist';
          addToWatchlistBtn.className = 'btn btn-secondary';
          addToWatchlistBtn.disabled = true;
        });
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
          <button onclick="showSection(homeSection)" class="btn btn-primary">Back to Home</button>
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

  searchMovies(query)
    .then(movies => {
      renderMovies(searchResultsEl, movies);
      // Update page title or add search info
      const searchInfo = document.createElement('div');
      searchInfo.className = 'search-info';
      searchInfo.innerHTML = `<h2>Search Results for "${escapeHtml(query)}" (${movies.length} found)</h2>`;
      searchResultsEl.parentNode.insertBefore(searchInfo, searchResultsEl);
    })
    .catch(error => {
      console.error("Search failed:", error);
      searchResultsEl.innerHTML = `
        <div class="error-container">
          <p class="error">Search failed: ${error.message}</p>
          <button onclick="handleSearch()" class="btn btn-primary">Try Again</button>
        </div>
      `;
    });
}

// Watchlist Functions
function renderWatchlist() {
  if (!watchlistMoviesEl) return;

  if (!watchlist.length) {
    watchlistMoviesEl.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-bookmark fa-3x"></i>
        <h3>Your watchlist is empty</h3>
        <p>Add movies to your watchlist to see them here</p>
        <button onclick="showSection(homeSection)" class="btn btn-primary">Browse Movies</button>
      </div>
    `;
    return;
  }
  
  renderMovies(watchlistMoviesEl, watchlist);
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

function removeFromWatchlist(movieId) {
  watchlist = watchlist.filter(m => m.id !== movieId);
  localStorage.setItem('watchlist', JSON.stringify(watchlist));
  renderWatchlist();
}

// Helper Functions
function showSection(section) {
  if (!section) return;
  
  [homeSection, movieDetailsSection, searchResultsSection, watchlistSection]
    .forEach(s => s?.classList.add('hidden'));
  section.classList.remove('hidden');

  // Update active navigation
  navLinks.forEach(link => link.classList.remove('active'));
  const activeLink = Array.from(navLinks).find(link => {
    if (section === homeSection) return link.dataset.section === 'movies';
    if (section === watchlistSection) return link.dataset.section === 'watchlist';
    return false;
  });
  activeLink?.classList.add('active');
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

// Event Listeners
function setupEventListeners() {
  // Search
  if (searchBtnEl) {
    searchBtnEl.addEventListener('click', handleSearch);
  }
  
  if (searchInputEl) {
    searchInputEl.addEventListener('keyup', e => {
      if (e.key === 'Enter') handleSearch();
    });
  }

  // Navigation
  navLinks.forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const section = link.dataset.section;
      
      // Remove search info if it exists
      const searchInfo = document.querySelector('.search-info');
      if (searchInfo) searchInfo.remove();
      
      if (section === 'movies') {
        showSection(homeSection);
      } else if (section === 'watchlist') {
        showSection(watchlistSection);
      } else {
        showError('This section is coming soon!');
      }
    });
  });

  // Theme Toggle
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', toggleTheme);
    
    // Apply saved theme
    if (localStorage.getItem('darkTheme') === 'true') {
      document.body.classList.add('dark-theme');
      themeToggleBtn.classList.remove('fa-moon');
      themeToggleBtn.classList.add('fa-sun');
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