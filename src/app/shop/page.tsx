"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ShoppingCart,
  Search,
  Filter,
  ChevronRight,
  Star,
  ArrowUpDown,
  Package,
  Heart,
  ArrowRight,
  GitCompare,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useToast } from "@/contexts/toast-context";
import { useWishlist } from "@/contexts/wishlist-context";
import { useCompare } from "@/contexts/compare-context";
import { useCustomerAuth } from "@/contexts/customer-auth-context";
import { trackAddToCart, trackViewItemList } from "@/lib/analytics";

interface WarehouseStock {
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  available: number;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  brand?: string | null;
  price: number;
  originalPrice?: number;
  currency: string;
  sku: string | null;
  images: string[];
  category: {
    id: string;
    name: string;
  };
  inStock: boolean;
  stockQuantity: number;
  lowStock: boolean;
  warehouseStock?: WarehouseStock[];
  isBestDeal?: boolean;
  bestDealPrice?: number | null;
}

interface Category {
  id: string;
  name: string;
  description: string | null;
  productCount: number;
}

const PRICE_BRACKETS = [
  { id: "all", label: "Any price", min: undefined, max: undefined },
  { id: "under-100", label: "Under ₵100", min: undefined, max: 100 },
  { id: "100-250", label: "₵100 - ₵250", min: 100, max: 250 },
  { id: "250-500", label: "₵250 - ₵500", min: 250, max: 500 },
  { id: "500-1000", label: "₵500 - ₵1,000", min: 500, max: 1000 },
  { id: "over-1000", label: "Above ₵1,000", min: 1000, max: undefined },
];

function ShopPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get("search") ?? "";
  const initialCategory = searchParams.get("category") ?? "";
  const initialSort = searchParams.get("sort") ?? "newest";
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [sortBy, setSortBy] = useState(initialSort === "deals" ? "newest" : initialSort); // Map "deals" to "newest" for API
  const [showBestDealsOnly, setShowBestDealsOnly] = useState(initialSort === "deals");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [addingToCart, setAddingToCart] = useState<string | null>(null);
  const [selectedPriceBracket, setSelectedPriceBracket] = useState<string>(PRICE_BRACKETS[0].id);
  const [minPriceInput, setMinPriceInput] = useState<string>("");
  const [maxPriceInput, setMaxPriceInput] = useState<string>("");
  const [cartCount, setCartCount] = useState(0);
  const { refreshCartCount } = useCustomerAuth();
  const { success, error: showError } = useToast();
  const { addItem: addWishlistItem, isInWishlist } = useWishlist();
  const {
    addItem: addCompareItem,
    isInCompare,
    maxItems: maxCompareItems,
  } = useCompare();
  const [hasTrackedList, setHasTrackedList] = useState(false);
  const [promoSection, setPromoSection] = useState<{
    title?: string | null;
    subtitle?: string | null;
    description?: string | null;
    ctaText?: string | null;
    ctaLink?: string | null;
    gradient?: string | null;
  } | null>(null);

  useEffect(() => {
    fetchCategories();
    fetchPromoSection();
  }, []);

  const fetchPromoSection = async () => {
    try {
      const response = await fetch('/api/public/storefront/sections/shop_promo');
      if (response.ok) {
        const data = await response.json();
        if (data.section && data.section.isActive) {
          setPromoSection(data.section);
        }
      }
    } catch (error) {
      console.error('Error fetching promo section:', error);
    }
  };

  useEffect(() => {
    const nextSearch = searchParams.get("search") ?? "";
    if (nextSearch !== searchTerm) {
      setSearchTerm(nextSearch);
      setPage(1);
    }
  }, [searchParams, searchTerm]);

  useEffect(() => {
    const nextCategory = searchParams.get("category") ?? "";
    const nextSort = searchParams.get("sort") ?? "newest";
    const isBestDeals = nextSort === "deals";
    if (nextCategory !== selectedCategory) {
      setSelectedCategory(nextCategory);
      setPage(1);
    }
    if (nextSort !== (sortBy === "deals" ? "deals" : sortBy)) {
      setSortBy(isBestDeals ? "newest" : nextSort); // Map "deals" to "newest" for API
      setShowBestDealsOnly(isBestDeals);
      setPage(1);
    }
  }, [searchParams, selectedCategory, sortBy]);

  useEffect(() => {
    setHasTrackedList(false);
    fetchProducts();
  }, [page, selectedCategory, sortBy, searchTerm, selectedPriceBracket, minPriceInput, maxPriceInput, showBestDealsOnly]);

  useEffect(() => {
    if (products.length === 0) {
      setHasTrackedList(false);
      return;
    }

    if (hasTrackedList) {
      return;
    }

    const listName = selectedCategory
      ? categories.find((category) => category.id === selectedCategory)?.name ?? "Shop Results"
      : searchTerm
      ? `Search: ${searchTerm}`
      : "Shop Results";

    trackViewItemList({
      items: products.map((product) => ({
        id: product.id,
        name: product.name,
        price: product.price,
        currency: product.currency,
        category: product.category?.name ?? null,
        sku: product.sku,
      })),
      listName,
      listId: selectedCategory || undefined,
    });

    setHasTrackedList(true);
  }, [products, hasTrackedList, selectedCategory, categories, searchTerm]);

  const fetchCategories = async () => {
    try {
      const response = await fetch("/api/public/shop/categories");
      const data = await response.json();
      setCategories(data.categories || []);
    } catch (error) {
      console.error("Failed to fetch categories:", error);
    }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "12",
        sort: sortBy === "deals" ? "newest" : sortBy, // Use "newest" for API, we'll filter client-side
      });

      if (searchTerm) params.append("search", searchTerm);
      if (selectedCategory) params.append("category", selectedCategory);
      if (showBestDealsOnly) params.append("bestDealsOnly", "true");

      const selectedBracket = PRICE_BRACKETS.find((bracket) => bracket.id === selectedPriceBracket);
      const resolvedMin =
        selectedBracket?.min ?? (minPriceInput.trim() ? Number(minPriceInput.trim()) : undefined);
      const resolvedMax =
        selectedBracket?.max ?? (maxPriceInput.trim() ? Number(maxPriceInput.trim()) : undefined);

      if (resolvedMin !== undefined && !Number.isNaN(resolvedMin)) {
        params.append("minPrice", resolvedMin.toString());
      }
      if (resolvedMax !== undefined && !Number.isNaN(resolvedMax)) {
        params.append("maxPrice", resolvedMax.toString());
      }

      const response = await fetch(`/api/public/shop/products?${params}`);
      const data = await response.json();
      
      setProducts(data.products || []);
      setTotalPages(data.pagination?.pages || 1);
    } catch (error) {
      console.error("Failed to fetch products:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCart = useCallback(async () => {
    try {
      const response = await fetch("/api/public/shop/cart");
      const data = await response.json();
      setCartCount(data.itemCount || 0);
    } catch (error) {
      console.error("Failed to fetch cart:", error);
    }
  }, []);

  useEffect(() => {
    void fetchCart();
  }, [fetchCart]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    const trimmed = searchTerm.trim();

    if (trimmed) {
      params.set("search", trimmed);
    } else {
      params.delete("search");
    }

    setPage(1);
    router.replace(params.toString() ? `/shop?${params}` : "/shop");
  };

  const clearSearch = () => {
    setSearchTerm("");
    setSelectedCategory("");
    setPage(1);

    const params = new URLSearchParams(searchParams.toString());
    params.delete("search");
    router.replace(params.toString() ? `/shop?${params}` : "/shop");
  };

  const addToCart = async (productId: string) => {
    try {
      setAddingToCart(productId);
      const response = await fetch("/api/public/shop/cart", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId,
          quantity: 1,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setCartCount(data.cartItemCount || cartCount + 1);
        const product = products.find(p => p.id === productId);
        success("Added to cart!", product?.name || "Product added successfully");
        if (product) {
          trackAddToCart({
            id: product.id,
            name: product.name,
            price: product.price,
            currency: product.currency,
            quantity: 1,
            category: product.category?.name,
            sku: product.sku ?? undefined,
          });
        }
        await fetchCart(); // Refresh local count
        await refreshCartCount(); // Update global header badge
      } else {
        const errorData = await response.json();
        showError(errorData.error || "Failed to add to cart", errorData.availableStock ? `Only ${errorData.availableStock} available` : undefined);
      }
    } catch (error) {
      console.error("Failed to add to cart:", error);
      showError("Failed to add to cart", "Please try again");
    } finally {
      setAddingToCart(null);
    }
  };

  const formatPrice = (price: number, currency: string = "GHS") => {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 2,
    }).format(price);
  };

  const getDiscountPercentage = (price: number, originalPrice?: number) => {
    if (!originalPrice || originalPrice <= price) return 0;
    return Math.round(((originalPrice - price) / originalPrice) * 100);
  };

  const handleAddToWishlist = (product: Product) => {
    const alreadyInWishlist = isInWishlist(product.id);

    addWishlistItem({
      id: product.id,
      name: product.name,
      price: product.price,
      currency: product.currency,
      image: product.images?.[0] ?? null,
      sku: product.sku ?? undefined,
    });

    success(
      alreadyInWishlist ? "Already in wishlist" : "Added to wishlist",
      alreadyInWishlist
        ? `${product.name} is already saved for later`
        : `${product.name} saved for later`
    );
  };

  const handleAddToCompare = (product: Product) => {
    const result = addCompareItem({
      id: product.id,
      name: product.name,
      price: product.price,
      currency: product.currency,
      image: product.images?.[0] ?? null,
      sku: product.sku ?? undefined,
      categoryName: product.category?.name ?? null,
      inStock: product.inStock,
      stockQuantity: product.stockQuantity,
    });

    if (result.added) {
      success("Added to compare", `${product.name} ready for comparison`);
      return;
    }

    if (result.reason === "duplicate") {
      success("Already in compare", `${product.name} is already in your comparison list`);
      return;
    }

    if (result.reason === "limit") {
      showError(
        "Compare limit reached",
        `You can compare up to ${maxCompareItems} products at a time.`
      );
    }
  };

  return (
    <div className="relative">

      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:gap-10 lg:h-[calc(100vh-8rem)]">
          {/* Sidebar Filters */}
          <aside
            className={`${
              showFilters ? "block" : "hidden lg:block"
            } lg:w-72 lg:shrink-0 lg:sticky lg:top-6 lg:h-[calc(100vh-9rem)]`}
          >
            <div className="rounded-2xl bg-white p-6 shadow lg:max-h-full lg:overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Filters</h3>
                <button
                  onClick={() => setShowFilters(false)}
                  className="lg:hidden text-gray-500 hover:text-gray-700"
                >
                  ×
                </button>
              </div>

              {/* Categories */}
              <div className="mb-6">
                <h4 className="font-medium mb-3">Categories</h4>
                <div className="space-y-2">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="category"
                      value=""
                      checked={selectedCategory === ""}
                      onChange={(e) => {
                        setSelectedCategory(e.target.value);
                        setPage(1);
                      }}
                      className="mr-2"
                    />
                    <span className="text-sm">All Products</span>
                  </label>
                  {categories.map((category) => (
                    <label key={category.id} className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        name="category"
                        value={category.id}
                        checked={selectedCategory === category.id}
                        onChange={(e) => {
                          setSelectedCategory(e.target.value);
                          setPage(1);
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm">
                        {category.name} ({category.productCount})
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Price Range */}
              <div className="mb-6">
                <h4 className="font-medium mb-3">Price Range</h4>
                <div className="space-y-2">
                  {PRICE_BRACKETS.map((bracket) => (
                    <label key={bracket.id} className="flex items-center cursor-pointer text-sm">
                      <input
                        type="radio"
                        name="priceBracket"
                        value={bracket.id}
                        checked={selectedPriceBracket === bracket.id}
                        onChange={(e) => {
                          setSelectedPriceBracket(e.target.value);
                          setPage(1);
                        }}
                        className="mr-2"
                      />
                      {bracket.label}
                    </label>
                  ))}
                </div>

                <div className="mt-4 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">or choose a custom range</p>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      placeholder="Min"
                      value={minPriceInput}
                      onChange={(e) => setMinPriceInput(e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-gray-400">—</span>
                    <input
                      type="number"
                      placeholder="Max"
                      value={maxPriceInput}
                      onChange={(e) => setMaxPriceInput(e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    onClick={() => {
                      setSelectedPriceBracket("all");
                      setMinPriceInput("");
                      setMaxPriceInput("");
                      setPage(1);
                    }}
                    className="w-full rounded-full border border-gray-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 transition hover:bg-gray-100"
                  >
                    Clear price filter
                  </button>
                </div>
              </div>

              {/* Sort */}
              <div>
                <h4 className="font-medium mb-3">Sort By</h4>
                <select
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="newest">Newest First</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                  <option value="name">Name: A to Z</option>
                </select>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 lg:overflow-y-auto lg:pr-2">
            {/* Mobile Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="lg:hidden mb-4 flex items-center space-x-2 text-blue-600 hover:text-blue-700"
            >
              <Filter className="h-5 w-5" />
              <span>Filters</span>
            </button>

            {searchTerm && (
              <div className="mb-4 flex flex-col gap-2 rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3 text-sm text-blue-700 md:flex-row md:items-center md:justify-between">
                <span>
                  Showing results for <strong>“{searchTerm}”</strong>
                </span>
                <button
                  onClick={clearSearch}
                  className="inline-flex items-center text-xs font-semibold uppercase tracking-wide text-blue-600 hover:text-blue-700"
                >
                  Clear search
                </button>
              </div>
            )}

            {/* Products Grid */}
            {loading ? (
              <div className="grid grid-cols-2 gap-6 sm:grid-cols-2 md:grid-cols-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="bg-white rounded-lg shadow p-4 animate-pulse">
                    <div className="bg-gray-200 h-48 rounded mb-4"></div>
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
                <p className="text-gray-500">Try adjusting your search or filters</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-6 sm:grid-cols-2 md:grid-cols-3" style={{ padding: '4px', overflow: 'visible' }}>
                  {products.map((product) => {
                    const wishlisted = isInWishlist(product.id);
                    return (
                    <div
                      key={product.id}
                      className="group relative"
                      style={{ padding: '3px' }}
                    >
                      {/* Hover ring wrapper - positioned outside the card */}
                      <div className="absolute -inset-[3px] rounded-[22px] border-[3px] border-[#23185c] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10"></div>
                      <div className="relative flex h-full flex-col rounded-2xl border border-gray-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                      <div className="overflow-hidden rounded-2xl relative z-0">
                      <Link href={`/shop/products/${product.id}`} className="relative block">
                          {product.images && product.images.length > 0 ? (
                            <img
                              src={product.images[0]}
                              alt={product.name}
                            className="h-48 w-full object-cover transition duration-300 group-hover:scale-105"
                            />
                          ) : (
                          <div className="flex h-48 w-full items-center justify-center bg-gray-100 text-gray-400">
                            <Package className="h-10 w-10" />
                            </div>
                          )}
                          <div className="absolute right-3 top-3 flex flex-col gap-2">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.preventDefault();
                                handleAddToWishlist(product);
                              }}
                              aria-pressed={wishlisted}
                              className={`flex h-9 w-9 items-center justify-center rounded-full border transition ${
                                wishlisted
                                  ? "border-[#23185c] bg-[#23185c] text-white"
                                  : "border-white/50 bg-white/90 text-[#23185c] hover:bg-white"
                              }`}
                            >
                              <Heart
                                className="h-4 w-4"
                                strokeWidth={wishlisted ? 0 : 2}
                                fill={wishlisted ? "currentColor" : "none"}
                              />
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.preventDefault();
                                handleAddToCompare(product);
                              }}
                              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/50 bg-white/90 text-[#23185c] transition hover:bg-white"
                            >
                              <GitCompare className="h-4 w-4" />
                            </button>
                          </div>
                        {product.isBestDeal && (
                          <span className="absolute left-4 top-4 rounded-full bg-[#23185c] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white z-10">
                            Best Deal
                          </span>
                        )}
                        {product.originalPrice && product.originalPrice > product.price && (
                          <span className={`absolute ${product.isBestDeal ? 'left-4 top-14' : 'left-4 top-4'} rounded-full bg-green-500 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white z-10`}>
                            {getDiscountPercentage(product.price, product.originalPrice)}% Off
                          </span>
                        )}
                          {!product.inStock && (
                          <span className="absolute left-4 top-4 rounded-full bg-red-500 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                              Out of Stock
                            </span>
                          )}
                        {product.lowStock && product.inStock && !product.isBestDeal && (
                          <span className="absolute right-4 top-4 rounded-full bg-orange-500 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                            Low Stock
                            </span>
                          )}
                      </Link>
                      </div>

                      <div className="flex flex-1 flex-col px-4 py-4">
                        <Link href={`/shop/products/${product.id}`}>
                          <h3 className="text-sm font-semibold text-gray-900 transition group-hover:text-blue-600">
                            {product.name}
                          </h3>
                        </Link>
                        {product.brand && (
                          <p className="text-xs text-gray-500 mt-1">{product.brand}</p>
                        )}
                        
                        <div className="mt-3 flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-lg font-bold text-gray-900">
                              {formatPrice(product.price, product.currency)}
                            </span>
                            {product.originalPrice && product.originalPrice > product.price ? (
                              <span className="text-xs text-gray-400 line-through mt-0.5">
                                {formatPrice(product.originalPrice, product.currency)}
                              </span>
                            ) : null}
                          </div>
                          <span className="text-xs text-gray-500">{product.category?.name}</span>
                        </div>

                          <div className="mt-4">
                        <button
                            onClick={(event) => {
                              event.preventDefault();
                              addToCart(product.id);
                            }}
                          disabled={!product.inStock || addingToCart === product.id}
                              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#23185c] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1c1448] group-hover:ring-2 group-hover:ring-[#23185c] group-hover:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-300"
                          >
                            <ShoppingCart className="h-4 w-4" />
                            {addingToCart === product.id ? "Adding..." : "Add to Cart"}
                          </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (() => {
                  // Generate page numbers to display
                  const getPageNumbers = () => {
                    const pages: (number | string)[] = [];
                    const maxVisible = 7; // Show up to 7 page numbers
                    
                    if (totalPages <= maxVisible) {
                      // Show all pages if total is small
                      for (let i = 1; i <= totalPages; i++) {
                        pages.push(i);
                      }
                    } else {
                      // Always show first page
                      pages.push(1);
                      
                      if (page <= 3) {
                        // Near the beginning: show 1, 2, 3, 4, ..., last
                        for (let i = 2; i <= 4; i++) {
                          pages.push(i);
                        }
                        pages.push('...');
                        pages.push(totalPages);
                      } else if (page >= totalPages - 2) {
                        // Near the end: show 1, ..., last-3, last-2, last-1, last
                        pages.push('...');
                        for (let i = totalPages - 3; i <= totalPages; i++) {
                          pages.push(i);
                        }
                      } else {
                        // In the middle: show 1, ..., current-1, current, current+1, ..., last
                        pages.push('...');
                        for (let i = page - 1; i <= page + 1; i++) {
                          pages.push(i);
                        }
                        pages.push('...');
                        pages.push(totalPages);
                      }
                    }
                    
                    return pages;
                  };
                  
                  const pageNumbers = getPageNumbers();
                  
                  return (
                    <div className="mt-8 flex justify-center">
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        <button
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={page === 1}
                          className="px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Previous
                        </button>
                        
                        {pageNumbers.map((pageNum, index) => {
                          if (pageNum === '...') {
                            return (
                              <span key={`ellipsis-${index}`} className="px-2 py-2 text-gray-500">
                                ...
                              </span>
                            );
                          }
                          
                          const num = pageNum as number;
                          return (
                            <button
                              key={num}
                              onClick={() => setPage(num)}
                              className={`px-4 py-2 border rounded-lg transition-colors ${
                                page === num
                                  ? "bg-[#23185c] text-white border-[#23185c] hover:bg-[#1c1448]"
                                  : "hover:bg-gray-50 border-gray-300"
                              }`}
                            >
                              {num}
                            </button>
                          );
                        })}

                        <button
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                          disabled={page === totalPages}
                          className="px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </>
            )}

          </main>
        </div>

        {/* Promo Card - Before footer, outside scrollable area - Managed via /ecommerce/cms */}
        <section 
            className={`mt-10 rounded-2xl p-4 text-white shadow-lg ${
              promoSection?.gradient 
                ? `bg-gradient-to-r ${promoSection.gradient}`
                : 'bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-700'
            }`}
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                {promoSection?.subtitle && (
                  <span className="inline-flex items-center rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                    {promoSection.subtitle}
                  </span>
                )}
                {!promoSection?.subtitle && (
                  <span className="inline-flex items-center rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                    Summer Splash Deals
                  </span>
                )}
                <h2 className="mt-2 text-xl font-bold leading-tight lg:text-2xl">
                  {promoSection?.title || 'Save More On Poolside Essentials'}
                </h2>
                <p className="mt-1.5 max-w-2xl text-xs text-white/80">
                  {promoSection?.description || 'Bundle chemicals, floats, and accessories to unlock free express delivery and exclusive loyalty rewards. Perfect for weekend gatherings and maintenance pros.'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {promoSection?.ctaText && promoSection?.ctaLink ? (
                  <Link
                    href={promoSection.ctaLink}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-blue-600 shadow transition hover:bg-blue-50"
                  >
                    {promoSection.ctaText}
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                ) : (
                  <>
                    <Link
                      href="/shop?sort=deals"
                      className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-blue-600 shadow transition hover:bg-blue-50"
                    >
                      Shop Best Deals
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                    <Link
                      href="/shop?category=chemicals"
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/50 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-white/10"
                    >
                      Pool Care Kits
                      <ChevronRight className="h-3 w-3" />
                    </Link>
                  </>
                )}
              </div>
            </div>
          </section>
      </div>
    </div>
  );
}

export default function ShopPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    }>
      <ShopPageContent />
    </Suspense>
  );
}
