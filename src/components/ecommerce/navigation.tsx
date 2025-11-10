"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ChevronDown,
  GitCompare,
  Heart,
  Menu,
  Phone,
  Search,
  ShoppingBag,
  ShoppingCart,
  User,
  X,
  Package,
} from "lucide-react";
import { useBranding } from "@/contexts/branding-context";
import { usePathname, useRouter } from "next/navigation";
import { useCustomerAuth } from "@/contexts/customer-auth-context";
import { useCartFlyout } from "@/contexts/cart-flyout-context";
import { useWishlist } from "@/contexts/wishlist-context";
import { useCompare } from "@/contexts/compare-context";

// Simple debounce helper to avoid extra dependency
function debounce<T extends (...args: any[]) => void>(fn: T, delay = 250) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const debounced = (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      fn(...args);
    }, delay);
  };
  debounced.cancel = () => {
    if (timeout) {
      clearTimeout(timeout);
    }
  };
  return debounced as T & { cancel: () => void };
}

interface MenuCategory {
  id: string;
  name: string;
  productCount?: number;
  href: string;
}

interface ProductSuggestion {
  id: string;
  name: string;
  price: number;
  currency: string;
  images: string[];
}

export function EcommerceNavigation() {
  const router = useRouter();
  const { branding } = useBranding();
  const { customer, logout, cartCount, refreshCartCount } = useCustomerAuth();
  const { openCart } = useCartFlyout();
  const { count: wishlistCount } = useWishlist();
  const { count: compareCount } = useCompare();

  const [searchTerm, setSearchTerm] = useState("");
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [menuCategories, setMenuCategories] = useState<MenuCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [suggestions, setSuggestions] = useState<ProductSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const primaryLinks = useMemo(
    () => [
      { label: "Home", href: "/" },
      { label: "All Products", href: "/shop" },
      { label: "Best Deals", href: "/shop?sort=deals" },
      { label: "Shop by Brand", href: "/shop?view=brands" },
      { label: "Blog", href: "/blog" },
    ],
    []
  );

  useEffect(() => {
    void refreshCartCount();
  }, [refreshCartCount]);

  useEffect(() => {
    let ignore = false;

    const fetchCategories = async () => {
    try {
        setLoadingCategories(true);
        const response = await fetch("/api/public/shop/categories");
        if (!response.ok) {
          throw new Error("Failed to fetch categories");
        }
        const data = await response.json();
        if (!ignore && data?.categories?.length) {
          const mapped: MenuCategory[] = data.categories.map((cat: any) => ({
            id: cat.id,
            name: cat.name,
            productCount: cat.productCount,
            href: `/shop?category=${cat.id}`,
          }));
          setMenuCategories(mapped);
      }
    } catch (error) {
        console.error("Failed to load navigation categories", error);
        if (!ignore) {
          setMenuCategories([]);
        }
      } finally {
        if (!ignore) {
          setLoadingCategories(false);
        }
      }
    };

    fetchCategories();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setSuggestions([]);
      return;
    }

    const fetchSuggestions = debounce(async (term: string) => {
      try {
        setIsSearching(true);
        const response = await fetch(`/api/public/shop/products?search=${encodeURIComponent(term)}&limit=3`);
        if (!response.ok) {
          throw new Error("Failed to fetch suggestions");
        }
        const data = await response.json();
        const products = data?.products ?? [];
        setSuggestions(products.slice(0, 3));
      } catch (error) {
        console.error("Search suggestions error:", error);
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    fetchSuggestions(searchTerm);

    return () => {
      fetchSuggestions.cancel();
    };
  }, [searchTerm]);

  const categoryColumns = useMemo(() => {
    if (menuCategories.length === 0) {
      return [] as MenuCategory[][];
    }
    const columnCount = 3;
    const perColumn = Math.ceil(menuCategories.length / columnCount);
    return Array.from({ length: columnCount }, (_, index) =>
      menuCategories.slice(index * perColumn, (index + 1) * perColumn)
    ).filter((column) => column.length > 0);
  }, [menuCategories]);

  const handleCategoryNavigate = (href: string) => {
    setIsCategoriesOpen(false);
    setIsMobileMenuOpen(false);
    router.push(href);
  };

  const mobileCategoryItems = useMemo(() => menuCategories, [menuCategories]);

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    if (searchTerm.trim()) {
      router.push(`/shop?search=${encodeURIComponent(searchTerm)}`);
      setIsMobileMenuOpen(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white shadow-sm">
      {/* Top information bar */}
      <div className="hidden border-b border-gray-100 bg-[#23185c] text-xs text-white md:block">
        <div className="container mx-auto flex items-center justify-between px-4 py-2">
          <div className="flex items-center space-x-4">
            <span className="flex items-center gap-2 font-medium">
              <Phone className="h-4 w-4" />
              <span>
                Call on: <strong>+233 59 691 1818</strong> (8am - 5pm) &{" "}
                <strong>+233 56 111 2777</strong> (5pm till 8am)
              </span>
            </span>
              </div>
          <nav className="flex items-center space-x-3 font-medium">
            <Link
              href="/shop/wishlist"
              className="relative inline-flex items-center gap-2 hover:text-amber-200"
            >
              <span>My Wish List</span>
              {wishlistCount > 0 && (
                <span className="flex h-5 min-w-[1.3rem] items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-semibold text-[#23185c]">
                  {wishlistCount}
                </span>
              )}
            </Link>
            <span className="text-white/50">|</span>
            {customer ? (
              <>
                <Link href="/shop/account" className="hover:text-amber-200">
                  My Account
                </Link>
                <span className="text-white/50">|</span>
                <button onClick={() => logout()} className="hover:text-amber-200">
                  Sign Out
                </button>
                <span className="text-white/50">|</span>
                <Link
                  href="/shop/compare"
                  className="relative inline-flex items-center gap-2 hover:text-amber-200"
                >
                  <span>Compare Products</span>
                  {compareCount > 0 && (
                    <span className="flex h-5 min-w-[1.3rem] items-center justify-center rounded-full bg-white px-1 text-[10px] font-semibold text-[#23185c]">
                      {compareCount}
                    </span>
                  )}
                </Link>
              </>
            ) : (
              <>
                <Link href="/shop/auth/login" className="hover:text-amber-200">
                  Sign In
                </Link>
                <span className="text-white/50">|</span>
                <Link
                  href="/shop/compare"
                  className="relative inline-flex items-center gap-2 hover:text-amber-200"
                >
                  <span>Compare Products</span>
                  {compareCount > 0 && (
                    <span className="flex h-5 min-w-[1.3rem] items-center justify-center rounded-full bg-white px-1 text-[10px] font-semibold text-[#23185c]">
                      {compareCount}
                    </span>
                  )}
                </Link>
                <span className="text-white/50">|</span>
                <Link href="/shop/auth/register" className="hover:text-amber-200">
                  Create An Account
                </Link>
              </>
            )}
          </nav>
        </div>
      </div>

      {/* Primary navigation */}
      <div className="border-b border-gray-100">
        <div className="container mx-auto flex items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-3">
            <button
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 md:hidden"
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              aria-label="Toggle mobile menu"
            >
              {isMobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>

            <Link href="/" className="flex items-center space-x-3">
              {branding.companyLogo ? (
                <div className="relative h-12 w-auto">
                  <Image
                    src={branding.companyLogo}
                    alt={branding.companyName || "The POOLSHOP"}
                    width={150}
                    height={48}
                    className="h-12 w-auto object-contain"
                    priority
                  />
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <ShoppingBag className="h-8 w-8 text-[#23185c]" />
                  <span className="text-xl font-bold text-[#23185c]">
                    {branding.companyName || "The POOLSHOP"}
                  </span>
                </div>
              )}
            </Link>
          </div>

          {/* Search */}
          <form
            onSubmit={handleSearch}
            className="hidden flex-1 md:block md:max-w-2xl"
          >
            <div className="relative flex h-12 w-full items-center rounded-full border border-gray-200 bg-white pl-4 pr-2 shadow-sm focus-within:ring-2 focus-within:ring-[#23185c]/40">
              <Search className="mr-3 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search for pool products, brands or essentials..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="flex-1 border-none bg-transparent text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-full bg-[#23185c] px-6 py-2 text-sm font-semibold text-white transition hover:bg-[#1c1448]"
              >
                Search
              </button>

              {suggestions.length > 0 && (
                <div className="absolute left-0 top-full z-30 mt-2 w-full overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
                  <ul className="divide-y divide-gray-100">
                    {suggestions.map((product) => (
                      <li key={product.id}>
                        <Link
                          href={`/shop/products/${product.id}`}
                          className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-[#23185c]/5 hover:text-[#23185c]"
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100">
                            {product.images && product.images[0] ? (
                              <Image
                                src={product.images[0]}
                                alt={product.name}
                                width={40}
                                height={40}
                                className="h-10 w-10 object-cover"
                              />
                            ) : (
                              <Package className="h-5 w-5 text-gray-300" />
                            )}
                          </div>
                          <div className="flex-1 overflow-hidden">
                            <p className="truncate font-medium">{product.name}</p>
                            <p className="text-xs text-gray-500">
                              {product.currency} {product.price.toLocaleString()}
                            </p>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </form>

          {/* Actions */}
          <div className="flex items-center gap-2 md:gap-3">
            <form
              onSubmit={handleSearch}
              className="flex md:hidden"
            >
              <div className="relative flex h-10 w-44 items-center rounded-full border border-gray-200 bg-white pl-3 pr-2 shadow-sm">
                <Search className="mr-2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="flex-1 border-none bg-transparent text-xs text-gray-700 placeholder:text-gray-400 focus:outline-none"
                />

                {suggestions.length > 0 && (
                  <div className="absolute left-0 top-full z-30 mt-2 w-[calc(100vw-2rem)] translate-x-[-50%] rounded-2xl border border-gray-200 bg-white shadow-xl sm:w-80">
                    <ul className="divide-y divide-gray-100">
                      {suggestions.map((product) => (
                        <li key={product.id}>
                          <Link
                            href={`/shop/products/${product.id}`}
                            className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-[#23185c]/5 hover:text-[#23185c]"
                            onClick={() => setIsMobileMenuOpen(false)}
                          >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100">
                              {product.images && product.images[0] ? (
                                <Image
                                  src={product.images[0]}
                                  alt={product.name}
                                  width={40}
                                  height={40}
                                  className="h-10 w-10 object-cover"
                                />
                              ) : (
                                <Package className="h-5 w-5 text-gray-300" />
                              )}
                            </div>
                            <div className="flex-1 overflow-hidden">
                              <p className="truncate font-medium">{product.name}</p>
                              <p className="text-xs text-gray-500">
                                {product.currency} {product.price.toLocaleString()}
                              </p>
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </form>

            <Link
              href="/shop/wishlist"
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-[#23185c] transition hover:border-[#23185c] hover:bg-[#23185c]/10 md:h-11 md:w-11"
              aria-label="View wishlist"
            >
              <Heart className="h-4 w-4" />
              {wishlistCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-[1.1rem] items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-semibold text-[#23185c]">
                  {wishlistCount}
                </span>
              )}
            </Link>

            <button
              type="button"
              onClick={openCart}
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#23185c] text-white transition hover:bg-[#1c1448] md:h-11 md:w-11"
              aria-label="Open cart"
            >
              <ShoppingCart className="h-4 w-4" />
              {cartCount > 0 ? (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-[1.1rem] items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-semibold text-[#23185c]">
                  {cartCount}
                </span>
              ) : null}
            </button>

            <Link
              href="/shop/compare"
              className="relative hidden h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-[#23185c] transition hover:border-[#23185c] hover:bg-[#23185c]/10 md:inline-flex"
              aria-label="Compare products"
            >
              <GitCompare className="h-4 w-4" />
              {compareCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-[1.1rem] items-center justify-center rounded-full bg-[#23185c] px-1 text-[10px] font-semibold text-white">
                  {compareCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </div>

      {/* Secondary navigation */}
      <div className="border-b border-gray-100">
        <div className="container mx-auto flex items-center justify-between px-4">
          <div className="relative">
            <button
              className="flex items-center gap-2 rounded-t-lg rounded-b-none bg-[#23185c] px-5 py-3 text-sm font-semibold text-white shadow"
              onMouseEnter={() => setIsCategoriesOpen(true)}
              onMouseLeave={() => setIsCategoriesOpen(false)}
              onClick={() => setIsCategoriesOpen((prev) => !prev)}
            >
              <Menu className="h-4 w-4" />
              Shop by Categories
              <ChevronDown className="ml-1 h-4 w-4" />
            </button>

            {isCategoriesOpen ? (
              <div
                className="absolute left-0 top-full z-30 w-screen max-w-4xl rounded-b-3xl border border-gray-200 bg-white p-6 shadow-2xl"
                onMouseEnter={() => setIsCategoriesOpen(true)}
                onMouseLeave={() => setIsCategoriesOpen(false)}
              >
                {menuCategories.length > 0 ? (
                  <div className="grid gap-6 sm:grid-cols-3">
                    {categoryColumns.map((column, columnIndex) => (
                      <div key={`column-${columnIndex}`} className="space-y-2">
                        {column.map((category) => (
                          <button
                            key={category.id}
                            onClick={() => handleCategoryNavigate(category.href)}
                            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium text-gray-700 transition hover:bg-[#23185c]/5 hover:text-[#23185c]"
                          >
                            <span>{category.name}</span>
                            {typeof category.productCount === "number" && (
                              <span className="text-xs font-normal text-gray-400">
                                {category.productCount}
                </span>
              )}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center rounded-2xl border border-dashed border-[#23185c]/20 bg-[#f8f8ff] p-8 text-center text-sm text-[#23185c]/60">
                    {loadingCategories ? "Loading categories…" : "No categories published yet"}
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <nav className="hidden flex-1 items-center justify-end gap-6 px-6 text-sm font-semibold text-gray-700 md:flex">
            {primaryLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="transition hover:text-[#23185c]"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      {/* Mobile menu */}
      {isMobileMenuOpen ? (
        <div className="border-b border-gray-200 bg-white md:hidden">
          <div className="space-y-4 px-4 py-4">
            <form onSubmit={handleSearch}>
              <div className="relative flex h-11 items-center rounded-full border border-gray-200 bg-white pl-4 pr-2 shadow-sm">
                <Search className="mr-3 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search for products..."
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="flex-1 border-none bg-transparent text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none"
                />
              </div>
            </form>

            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-xs font-semibold uppercase text-gray-500">
                Categories
              </p>
              <div className="mt-3 grid gap-2">
                {mobileCategoryItems.length > 0 ? (
                  <div className="space-y-1">
                    {mobileCategoryItems.map((category) => (
                      <button
                        key={category.id ?? category.name}
                        onClick={() => handleCategoryNavigate(category.href)}
                        className="rounded-lg bg-white px-4 py-2 text-left text-sm font-medium text-gray-700 shadow-sm hover:bg-[#23185c]/5 hover:text-[#23185c]"
                      >
                        {category.name}
                      </button>
                    ))}
                  </div>
                ) : loadingCategories ? (
                  <p className="text-sm text-gray-500">Loading categories…</p>
                ) : (
                  <p className="text-sm text-gray-500">No categories published yet.</p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-4">
              <p className="text-xs font-semibold uppercase text-gray-500">
                Quick Links
              </p>
              <div className="mt-3 grid gap-2">
                {primaryLinks.map((link) => (
            <Link
                    key={link.label}
                    href={link.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="rounded-lg bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-[#23185c]/5 hover:text-[#23185c]"
                  >
                    {link.label}
            </Link>
                ))}
              </div>
            </div>

            <div className="grid gap-2">
              <Link
                href="/shop/compare"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 hover:border-[#23185c] hover:text-[#23185c]"
              >
                <div className="relative flex items-center">
                  <GitCompare className="h-5 w-5" />
                  {compareCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 min-w-[1.1rem] items-center justify-center rounded-full bg-[#23185c] px-1 text-[10px] font-semibold text-white">
                      {compareCount}
                    </span>
                  )}
                </div>
                Compare
              </Link>
              <Link
                href="/shop/wishlist"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 hover:border-[#23185c] hover:text-[#23185c]"
              >
                <div className="relative flex items-center">
                <Heart className="h-5 w-5" />
                  {wishlistCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 min-w-[1.1rem] items-center justify-center rounded-full bg-[#23185c] px-1 text-[10px] font-semibold text-white">
                      {wishlistCount}
                    </span>
                  )}
                </div>
                Wish List
              </Link>
              <Link
                href="/shop/compare"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 hover:border-[#23185c] hover:text-[#23185c]"
              >
                <div className="relative flex items-center">
                  <GitCompare className="h-5 w-5" />
                  {compareCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 min-w-[1.1rem] items-center justify-center rounded-full bg-[#23185c] px-1 text-[10px] font-semibold text-white">
                      {compareCount}
                    </span>
                  )}
                </div>
                Compare
              </Link>
              <Link
                href={customer ? "/shop/account" : "/shop/auth/login"}
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 hover:border-[#23185c] hover:text-[#23185c]"
              >
                <User className="h-5 w-5" />
                {customer ? "My Account" : "Sign In"}
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
