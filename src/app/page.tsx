"use client"

import { useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Shield, Package, Star, Truck, ArrowRight, ShoppingCart, Heart, GitCompare } from "lucide-react"
import { BannerSlider } from "@/components/ecommerce/banner-slider"
import { EcommerceLayout } from "@/components/ecommerce/layout"
import { CustomerAuthProvider } from "@/contexts/customer-auth-context"
import { HeroSlider } from "@/components/ecommerce/hero-slider"
import { useToast } from "@/contexts/toast-context"
import { useWishlist } from "@/contexts/wishlist-context"
import { useCompare } from "@/contexts/compare-context"
import { useCustomerAuth } from "@/contexts/customer-auth-context"
import { RegisterServiceWorker } from "@/components/pwa/register-service-worker"
import { InstallPrompt } from "@/components/pwa/install-prompt"
import { EcommercePromoBanner } from "@/components/ecommerce/promo-banner";

type Product = {
  id: string
  name: string
  description: string | null
  price: number
  originalPrice?: number
  currency: string
  sku: string | null
  images: string[]
  category: {
    id: string
    name: string
  }
  inStock: boolean
  stockQuantity: number
  lowStock: boolean
  discountPercent?: number
}

interface Category {
  id: string;
  name: string;
  description: string | null;
  productCount: number;
  tileImageUrl: string | null;
  marketingTagline: string | null;
}

function ShopHomePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [isShopDomain, setIsShopDomain] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([])
  const [dealProducts, setDealProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [banners, setBanners] = useState<any[]>([])
  const { success: toastSuccess, error: toastError } = useToast()
  const { addItem: addWishlistItem, isInWishlist } = useWishlist()
  const {
    addItem: addCompareItem,
    isInCompare,
    maxItems: maxCompareItems,
  } = useCompare()
  const { refreshCartCount } = useCustomerAuth()
  const [addingToCart, setAddingToCart] = useState<string | null>(null)
  const heroSlides = useMemo(() => {
    if (!banners || banners.length === 0) return []

    return banners.map((banner, index) => ({
      id: banner.id || `banner-${index}`,
      eyebrow: banner.tagline || "Exclusive Offers",
      heading: banner.title || "Unbeatable Prices Everyday",
      subheading: banner.subtitle,
      description: banner.description || banner.linkText,
      ctaText: banner.linkText || "Shop Now",
      ctaLink: banner.link || "/shop",
      image: banner.image || null,
      accentColor: banner.accentColor,
    }))
  }, [banners])

  useEffect(() => {
    // Set mounted on client side only
    setMounted(true)
    
    // Only proceed if we're on the client
    if (typeof window === 'undefined') return
    
    // Wait for session to be ready
    if (status === "loading") return

    const hostname = window.location.hostname
    const port = window.location.port || (window.location.protocol === 'https:' ? '443' : '80')
    const isAdminDomain = hostname.includes('sms.') || hostname.includes('admin.')
    const isAdminPort = port === '3001'
    const isShopPort = port === '3000'
    const isShop = isShopPort || (!isAdminDomain && !isAdminPort)

    setIsShopDomain(isShop)

    // Admin domain/port - redirect to dashboard or login
    if (isAdminDomain || isAdminPort) {
      if (session) {
        router.push("/dashboard")
      } else {
        router.push("/auth/signin")
      }
      return
    }

    // Shop domain - fetch homepage data
    if (isShop) {
      fetchFeaturedProducts()
      fetchCategories()
      fetchBanners()
      fetchDeals()
    }
  }, [session, status, router])

  const fetchFeaturedProducts = async () => {
    try {
      const response = await fetch("/api/public/shop/products?limit=8&sort=newest")
      if (response.ok) {
        const data = await response.json()
        setFeaturedProducts(data.products?.slice(0, 8) || [])
      } else {
        console.error("Failed to fetch featured products:", response.status)
        setFeaturedProducts([])
      }
    } catch (error) {
      console.error("Failed to fetch featured products:", error)
      setFeaturedProducts([])
    } finally {
      setLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const response = await fetch("/api/public/shop/categories")
      if (response.ok) {
        const data = await response.json()
        setCategories(data.categories?.slice(0, 6) || [])
      } else {
        console.error("Failed to fetch categories:", response.status)
        setCategories([])
      }
    } catch (error) {
      console.error("Failed to fetch categories:", error)
      setCategories([])
    }
  }

  const fetchBanners = async () => {
    try {
      const response = await fetch("/api/public/shop/banners")
      if (response.ok) {
        const data = await response.json()
        setBanners(data.banners || [])
      } else {
        console.error("Failed to fetch banners:", response.status)
        setBanners([])
      }
    } catch (error) {
      console.error("Failed to fetch banners:", error)
      setBanners([])
    }
  }

  const fetchDeals = async () => {
    try {
      const response = await fetch("/api/public/shop/deals?limit=6")
      if (response.ok) {
        const data = await response.json()
        setDealProducts(data.deals || [])
      }
    } catch (error) {
      console.error("Failed to fetch deals:", error)
      setDealProducts([])
    }
  }

  const handleAddToWishlist = (product: Product) => {
    const alreadyInWishlist = isInWishlist(product.id)

    addWishlistItem({
      id: product.id,
      name: product.name,
      price: product.price,
      currency: product.currency,
      image: product.images?.[0] ?? null,
      sku: product.sku ?? undefined,
    })

    toastSuccess(
      alreadyInWishlist ? "Already in wishlist" : "Added to wishlist",
      alreadyInWishlist
        ? `${product.name} is already saved for later`
        : `${product.name} saved for later`
    )
  }

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
    })

    if (result.added) {
      toastSuccess("Added to compare", `${product.name} ready for comparison`)
      return
    }

    if (result.reason === "duplicate") {
      toastSuccess("Already in compare", `${product.name} is already on your comparison board`)
      return
    }

    if (result.reason === "limit") {
      toastError(
        "Compare limit reached",
        `You can compare up to ${maxCompareItems} products at a time.`
      )
    }
  }

  const handleAddToCart = async (product: Product) => {
    if (addingToCart === product.id) return

    try {
      setAddingToCart(product.id)
      const response = await fetch("/api/public/shop/cart", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ productId: product.id, quantity: 1 }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || "Unable to add to cart")
      }

      toastSuccess("Added to cart", `${product.name} is in your bag`)
      await refreshCartCount()
    } catch (error) {
      console.error("Failed to add product to cart", error)
      toastError(
        "Could not add to cart",
        error instanceof Error ? error.message : undefined
      )
    } finally {
      setAddingToCart(null)
    }
  }

  const formatPrice = (price: number, currency: string = "GHS") => {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 2,
    }).format(price)
  }

  // Show consistent loading state until mounted (prevents hydration mismatch)
  // Server and client must render the exact same initial content
  if (!mounted || status === "loading") {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    )
  }
  // Show ecommerce homepage on shop domain
  if (isShopDomain) {
    return (
        <EcommerceLayout>
        <RegisterServiceWorker />
        <InstallPrompt />

        {/* Hero Section */}
        <HeroSlider slides={heroSlides} />

        {/* Key Value Props */}
        <section className="pt-10">
          <div className="container mx-auto px-4">
            <div className="flex flex-col gap-3 rounded-3xl border border-gray-100 bg-white/80 p-5 shadow-sm backdrop-blur md:flex-row md:items-stretch md:gap-4">
              <div className="flex flex-1 items-start gap-3 rounded-2xl bg-white px-5 py-4 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-600">
                  <Truck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Same Day Delivery</h3>
                  <p className="text-xs text-gray-600">Fast delivery on COD orders within Greater Accra</p>
                </div>
              </div>
              <div className="flex flex-1 items-start gap-3 rounded-2xl bg-white px-5 py-4 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-600">
                  <Package className="h-5 w-5" />
            </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Free Shipping</h3>
                  <p className="text-xs text-gray-600">Accra, Tema &amp; Kumasi on orders above ₵50</p>
                </div>
              </div>
              <div className="flex flex-1 items-start gap-3 rounded-2xl bg-white px-5 py-4 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-600">
                  <Star className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Standard Delivery</h3>
                  <p className="text-xs text-gray-600">Within 48-72 hrs of order confirmation nationwide</p>
                </div>
              </div>
              <div className="flex flex-1 items-start gap-3 rounded-2xl bg-white px-5 py-4 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-600">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Safe &amp; Secure Payments</h3>
                  <p className="text-xs text-gray-600">Cash on delivery, MoMo, card &amp; bank transfer options</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Best Deals Section */}
        {dealProducts.length > 0 && (
          <section className="py-12">
            <div className="container mx-auto px-4">
              <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-500 to-emerald-700 p-10 text-white shadow-lg">
                  <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
                    Today’s Special Deal
                  </span>
                  <h3 className="mt-4 text-3xl font-bold leading-tight lg:text-4xl">
                    Healthy & Fresh
                    <br />
                    Vegetables
                  </h3>
                  <p className="mt-3 max-w-sm text-sm text-emerald-50">
                    Save up to 50% on seasonal produce, curated for your pool parties and weekend getaways. Bundle fresh picks with accessories and get free delivery.
                  </p>
                  <Link
                    href="/shop?sort=deals"
                    className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-semibold text-emerald-600 hover:bg-emerald-50"
                  >
                    Explore Deals
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <div className="pointer-events-none absolute -bottom-6 right-4 flex h-32 w-32 items-center justify-center rounded-full bg-white/20">
                    <span className="text-lg font-bold">Save 50%</span>
                  </div>
                </div>

                <div>
                  <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                      <h2 className="text-3xl font-bold text-gray-900">Best Deals</h2>
                      <p className="text-sm text-gray-600">
                        Deep discounts on poolside essentials—grab them before they’re gone.
                      </p>
                    </div>
                    <Link
                      href="/shop?sort=deals"
                      className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700"
                    >
                      View all deals
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>

                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {dealProducts.map((product) => {
                      const wishlisted = isInWishlist(product.id)
                      const inCompare = isInCompare(product.id)

                      return (
                      <div
                        key={product.id}
                          className="group relative flex flex-col overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl hover:ring-2 hover:ring-[#23185c] hover:ring-offset-2"
                      >
                        <Link href={`/shop/products/${product.id}`} className="relative block">
                          {product.images && product.images.length > 0 ? (
                            <img
                              src={product.images[0]}
                              alt={product.name}
                                className="h-40 w-full object-cover transition duration-300 group-hover:scale-105"
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
                                  event.preventDefault()
                                  handleAddToWishlist(product)
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
                                  event.preventDefault()
                                  handleAddToCompare(product)
                                }}
                                aria-pressed={inCompare}
                                className={`flex h-9 w-9 items-center justify-center rounded-full border transition ${
                                  inCompare
                                    ? "border-[#23185c] bg-[#23185c]/10 text-[#23185c]"
                                    : "border-white/50 bg-white/90 text-[#23185c] hover:bg-white"
                                }`}
                              >
                                <GitCompare className="h-4 w-4" />
                              </button>
                            </div>
                          {product.discountPercent && product.discountPercent > 0 && (
                            <span className="absolute left-4 top-4 rounded-full bg-red-500 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                              {product.discountPercent}% Off
                            </span>
                          )}
                        </Link>

                        <div className="flex flex-1 flex-col px-4 py-4">
                          <Link href={`/shop/products/${product.id}`}>
                            <h3 className="text-sm font-semibold text-gray-900 transition group-hover:text-blue-600">
                              {product.name}
                            </h3>
                          </Link>

                          <div className="mt-3 flex items-baseline gap-2">
                            <span className="text-base font-bold text-gray-900">
                              {formatPrice(product.price, product.currency)}
                            </span>
                            {product.originalPrice && (
                              <span className="text-sm text-gray-400 line-through">
                                {formatPrice(product.originalPrice, product.currency)}
                              </span>
                            )}
                          </div>

                          <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
                            <span>{product.category?.name ?? "Deals"}</span>
                            {product.stockQuantity > 0 ? (
                              <span>
                                {product.stockQuantity <= 5
                                  ? `Only ${product.stockQuantity} left`
                                  : `${product.stockQuantity} in stock`}
                              </span>
                            ) : (
                              <span className="text-red-500">Out of stock</span>
                            )}
                          </div>

                            <div className="mt-4">
                            <button
                              type="button"
                              disabled={addingToCart === product.id || !product.inStock}
                              onClick={() => handleAddToCart(product)}
                                className="inline-flex w-full items-center justify-center rounded-full bg-[#23185c] p-3 text-sm font-semibold text-white transition hover:bg-[#1c1448] group-hover:ring-2 group-hover:ring-[#23185c] group-hover:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-300"
                              aria-label="Add to cart"
                            >
                              <ShoppingCart className="h-4 w-4" />
                            </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Categories & Banners Section */}
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                Shop by Category
              </h2>
              <p className="text-gray-600 text-lg">
                Explore our wide range of pool products
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Categories - 2x2 Grid */}
              <div>
                {categories.length > 0 ? (
                  <div className="grid grid-cols-2 gap-6">
                    {categories.slice(0, 4).map((category) => (
                      <Link
                        key={category.id}
                        href={`/shop?category=${category.id}`}
                        className="group relative block aspect-[3/2] overflow-hidden rounded-3xl border border-transparent shadow-sm transition hover:-translate-y-1 hover:border-white/60 hover:shadow-xl"
                      >
                        {category.tileImageUrl ? (
                          <img
                            src={category.tileImageUrl}
                            alt={category.name}
                            className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <div className="absolute inset-0 bg-gradient-to-br from-[#23185c] to-blue-500" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/25 to-transparent" />
                        {!category.tileImageUrl && (
                          <div className="absolute left-5 top-5 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white">
                            <Package className="h-5 w-5" />
                          </div>
                        )}
                        <div className="relative flex h-full flex-col items-end justify-end p-5 text-right">
                          {category.marketingTagline ? (
                            <p className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-white/70">
                              {category.marketingTagline}
                            </p>
                          ) : null}
                          <h3 className="text-lg font-semibold text-white">
                            {category.name}
                          </h3>
                          <p className="text-xs text-white/70">
                            {category.productCount} {category.productCount === 1 ? "product" : "products"}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-12 text-center">
                    <p className="text-gray-500">No categories available</p>
                  </div>
                )}
              </div>

              {/* Banner Slider */}
              <div className="w-full">
                {banners.length > 0 ? (
                  <BannerSlider banners={banners} />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl flex items-center justify-center min-h-[300px]">
                    <p className="text-gray-500">No banners available</p>
                  </div>
                )}
              </div>
            </div>

            {categories.length > 0 && (
              <div className="text-center mt-10">
                <Link
                  href="/shop"
                  className="inline-flex items-center text-blue-600 font-semibold hover:text-blue-700"
                >
                  View All Categories
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* Featured Products Section */}
        {featuredProducts.length > 0 && (
          <section className="py-16 bg-gray-50">
            <div className="container mx-auto px-4">
              <div className="flex items-center justify-between mb-12">
                <div>
                  <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                    Featured Products
                  </h2>
                  <p className="text-gray-600 text-lg">
                    Check out our latest and most popular items
                  </p>
                </div>
                <Link
                  href="/shop"
                  className="hidden md:flex items-center text-blue-600 font-semibold hover:text-blue-700"
                >
                  View All
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </div>

              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="bg-white rounded-lg shadow p-4 animate-pulse">
                      <div className="bg-gray-200 h-48 rounded mb-4"></div>
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-6 sm:grid-cols-2 md:grid-cols-4">
                  {featuredProducts.map((product) => {
                    const wishlisted = isInWishlist(product.id)
                    const inCompare = isInCompare(product.id)

                    return (
                      <div
                      key={product.id}
                        className="group relative flex flex-col overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl hover:ring-2 hover:ring-[#23185c] hover:ring-offset-2"
                    >
                        <Link href={`/shop/products/${product.id}`} className="relative block">
                        {product.images && product.images.length > 0 ? (
                          <img
                            src={product.images[0]}
                            alt={product.name}
                              className="h-48 w-full object-cover transition duration-300 group-hover:scale-105"
                          />
                        ) : (
                            <div className="flex h-48 w-full items-center justify-center bg-gray-100 text-gray-400">
                            <Package className="h-12 w-12 text-gray-400" />
                          </div>
                        )}

                          <div className="absolute right-3 top-3 flex flex-col gap-2">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.preventDefault()
                                handleAddToWishlist(product)
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
                                event.preventDefault()
                                handleAddToCompare(product)
                              }}
                              aria-pressed={inCompare}
                              className={`flex h-9 w-9 items-center justify-center rounded-full border transition ${
                                inCompare
                                  ? "border-[#23185c] bg-[#23185c]/10 text-[#23185c]"
                                  : "border-white/50 bg-white/90 text-[#23185c] hover:bg-white"
                              }`}
                            >
                              <GitCompare className="h-4 w-4" />
                            </button>
                          </div>

                        {product.lowStock && (
                          <span className="absolute top-2 left-2 bg-orange-500 text-white text-xs px-2 py-1 rounded">
                            Low Stock
                          </span>
                        )}
                        {!product.inStock && (
                          <span className="absolute top-2 left-2 bg-red-500 text-white text-xs px-2 py-1 rounded">
                            Out of Stock
                          </span>
                        )}
                        {product.originalPrice && product.originalPrice > product.price && (
                          <span className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded">
                            Sale
                          </span>
                        )}
                        </Link>

                        <div className="flex flex-1 flex-col px-5 py-5">
                          <Link href={`/shop/products/${product.id}`}>
                            <h3 className="text-sm font-semibold text-gray-900 transition group-hover:text-blue-600">
                          {product.name}
                        </h3>
                          </Link>
                          <div className="mt-3 flex items-center justify-between">
                          <div>
                            <span className="text-lg font-bold text-gray-900">
                              {formatPrice(product.price, product.currency)}
                            </span>
                            {product.originalPrice && product.originalPrice > product.price && (
                              <span className="ml-2 text-sm text-gray-500 line-through">
                                {formatPrice(product.originalPrice, product.currency)}
                              </span>
                            )}
                          </div>
                        </div>
                          <div className="mt-4">
                          <button
                            type="button"
                            disabled={addingToCart === product.id || !product.inStock}
                            onClick={(event) => {
                              event.preventDefault()
                              handleAddToCart(product)
                            }}
                              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#23185c] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1c1448] group-hover:ring-2 group-hover:ring-[#23185c] group-hover:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-300"
                          >
                            <ShoppingCart className="h-4 w-4" />
                            {addingToCart === product.id ? "Adding..." : "Add to Cart"}
                          </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="text-center mt-10 md:hidden">
                <Link
                  href="/shop"
                  className="inline-flex items-center text-blue-600 font-semibold hover:text-blue-700"
                >
                  View All Products
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* Promotional Strip */}
        <section className="py-12">
          <EcommercePromoBanner />
        </section>

      </EcommerceLayout>
    )
  }

  // Default landing page for localhost or other cases (only show after mounted)
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="w-full max-w-4xl p-6">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            The POOLSHOP
          </h1>
          <p className="text-xl text-gray-600 mb-12">
            Your trusted partner for quality products and services
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Link
              href="/shop"
              className="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-shadow"
            >
              <ShoppingCart className="h-12 w-12 text-blue-600 mx-auto mb-4" />
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                Shop Online
              </h2>
              <p className="text-gray-600 mb-4">
                Browse our products and shop from the comfort of your home
              </p>
              <span className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition">
                Visit Shop →
              </span>
            </Link>

            <Link
              href={session ? "/dashboard" : "/auth/signin"}
              className="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-shadow"
            >
              <Shield className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                Admin Portal
              </h2>
              <p className="text-gray-600 mb-4">
                Manage inventory, orders, and business operations
              </p>
              <span className="inline-block bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition">
                {session ? "Go to Dashboard →" : "Sign In →"}
              </span>
            </Link>
          </div>

          <div className="mt-12 text-sm text-gray-500">
            © 2024 The POOLSHOP. All rights reserved.
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Home() {
  return (
    <CustomerAuthProvider>
      <ShopHomePage />
    </CustomerAuthProvider>
  )
}