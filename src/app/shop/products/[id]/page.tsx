"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ShoppingCart, Package, Truck, Shield, Star } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/contexts/toast-context";
import { useCustomerAuth } from "@/contexts/customer-auth-context";
import { EcommercePromoBanner } from "@/components/ecommerce/promo-banner";
import { DEFAULT_STOREFRONT_CONTENT } from "@/lib/storefront-content";
import { trackAddToCart, trackViewItem } from "@/lib/analytics";

interface Testimonial {
  id: string;
  name: string;
  role?: string | null;
  rating: number;
  quote: string;
  avatarColor?: string | null;
  avatarImage?: string | null;
  isFeatured?: boolean;
  isActive?: boolean;
}

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
  barcode: string | null;
  images: string[];
  category: {
    id: string;
    name: string;
  };
  attributes: Record<string, any>;
  inStock: boolean;
  stockQuantity: number;
  lowStock: boolean;
  warehouseStock?: WarehouseStock[];
  isBestDeal?: boolean;
  bestDealPrice?: number | null;
}

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [addingToCart, setAddingToCart] = useState(false);
  const { success, error: showError } = useToast();
  const { refreshCartCount } = useCustomerAuth();
  const normalizeProductPromo = (banner: any) => {
    const defaults = DEFAULT_STOREFRONT_CONTENT.product_promo_banner as Record<string, any>;
    const base = {
      eyebrow: defaults?.eyebrow ?? "Poolside Upgrade",
      title: defaults?.title ?? "Bundle & Save on Spa Accessories",
      description:
        defaults?.description ??
        "Complete your relaxation setup with curated accessories. Members enjoy an extra 10% off when buying two or more.",
      ctaText: defaults?.ctaText ?? "Explore Accessories",
      ctaHref: defaults?.ctaHref ?? "/shop?category=accessories",
      gradient: defaults?.gradient ?? "from-sky-500 via-cyan-500 to-emerald-500",
      isActive: defaults?.isActive ?? true,
    };
    if (!banner) return base;
    return {
      ...base,
      ...banner,
      isActive: banner.isActive ?? base.isActive,
    };
  };

const normalizeTestimonials = (list: any): Testimonial[] => {
  if (!Array.isArray(list)) {
    return [];
  }

  return list
    .map((item) => {
      const rating =
        typeof item?.rating === "number" && item.rating >= 1 && item.rating <= 5
          ? Math.round(item.rating)
          : 5;
      return {
        id: item?.id ?? (typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : Math.random().toString(36).slice(2)),
        name: item?.name ?? "",
        role: item?.role ?? "",
        rating,
        quote: item?.quote ?? "",
        avatarColor: item?.avatarColor ?? "#2563eb",
        avatarImage: item?.avatarImage ?? null,
        isFeatured: item?.isFeatured ?? false,
        isActive: item?.isActive ?? true,
      } as Testimonial;
    })
    .filter((item) => item.name && item.quote);
};

const [reviews, setReviews] = useState<Testimonial[]>(
  normalizeTestimonials(DEFAULT_STOREFRONT_CONTENT.testimonials).filter(
    (testimonial) => testimonial.isActive !== false
  )
);
  const [recommendedProducts, setRecommendedProducts] = useState<Product[]>([]);
  const [productPromoBanner, setProductPromoBanner] = useState(
    normalizeProductPromo(DEFAULT_STOREFRONT_CONTENT.product_promo_banner)
  );
  const hasTrackedView = useRef(false);

  useEffect(() => {
    if (params.id) {
      hasTrackedView.current = false;
      fetchProduct(params.id as string);
    }
  }, [params.id]);

useEffect(() => {
  if (product) {
    void fetchRecommendedProducts(product.category.id, product.id);
    void fetchStorefrontContent();

    if (!hasTrackedView.current) {
      trackViewItem({
        id: product.id,
        name: product.name,
        price: product.price,
        currency: product.currency,
        quantity: 1,
        category: product.category?.name,
        sku: product.sku ?? undefined,
      });
      hasTrackedView.current = true;
    }
  }
}, [product]);

  const fetchProduct = async (productId: string) => {
    try {
      setLoading(true);
      const response = await fetch("/api/public/shop/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ productId }),
      });

      if (response.ok) {
        const data = await response.json();
        setProduct(data);
      } else {
        // Product not found
        router.push("/shop");
      }
    } catch (error) {
      console.error("Failed to fetch product:", error);
      router.push("/shop");
    } finally {
      setLoading(false);
    }
  };

  const addToCart = async () => {
    if (!product) return;

    try {
      setAddingToCart(true);
      const response = await fetch("/api/public/shop/cart", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId: product.id,
          quantity,
        }),
      });

      if (response.ok) {
        success("Added to cart!", `${quantity} x ${product.name} added successfully`);
        trackAddToCart({
          id: product.id,
          name: product.name,
          price: product.price,
          currency: product.currency,
          quantity,
          category: product.category?.name,
          sku: product.sku ?? undefined,
        });
        // Reset quantity
        setQuantity(1);
        await refreshCartCount();
        // Could also update cart count in header
      } else {
        const errorData = await response.json();
        showError(errorData.error || "Failed to add to cart", errorData.availableStock ? `Only ${errorData.availableStock} available` : undefined);
      }
    } catch (error) {
      console.error("Failed to add to cart:", error);
      showError("Failed to add to cart", "Please try again");
    } finally {
      setAddingToCart(false);
    }
  };

  const fetchRecommendedProducts = async (categoryId: string, currentProductId: string) => {
    try {
      const response = await fetch(`/api/public/shop/products?category=${encodeURIComponent(categoryId)}&limit=6&sort=newest`);
      if (!response.ok) {
        throw new Error("Failed to fetch recommendations");
      }
      const data = await response.json();
      const products: Product[] = data?.products || [];
      const filtered = products.filter((item) => item.id !== currentProductId).slice(0, 4);
      setRecommendedProducts(filtered);
    } catch (error) {
      console.error("Failed to fetch recommended products:", error);
      setRecommendedProducts([]);
    }
  };

  const fetchStorefrontContent = async () => {
    try {
      const response = await fetch(
        "/api/public/storefront/content?keys=product_promo_banner,testimonials"
      );
      if (response.ok) {
        const data = await response.json();
        const banner = normalizeProductPromo(data?.content?.product_promo_banner);
        setProductPromoBanner(banner);
        const testimonials = normalizeTestimonials(
          data?.content?.testimonials ?? DEFAULT_STOREFRONT_CONTENT.testimonials
        ).filter((testimonial) => testimonial.isActive !== false);
        setReviews(testimonials);
      } else {
        const fallback = normalizeTestimonials(DEFAULT_STOREFRONT_CONTENT.testimonials).filter(
          (testimonial) => testimonial.isActive !== false
        );
        setReviews(fallback);
        setProductPromoBanner(normalizeProductPromo(undefined));
      }
    } catch (error) {
      console.error("Failed to fetch storefront content:", error);
      const fallback = normalizeTestimonials(DEFAULT_STOREFRONT_CONTENT.testimonials).filter(
        (testimonial) => testimonial.isActive !== false
      );
      setReviews(fallback);
      setProductPromoBanner(normalizeProductPromo(undefined));
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="bg-white rounded-lg shadow p-6 animate-pulse">
              <div className="grid md:grid-cols-2 gap-8">
                <div className="bg-gray-200 h-96 rounded"></div>
                <div className="space-y-4">
                  <div className="h-8 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-32 bg-gray-200 rounded"></div>
                  <div className="h-12 bg-gray-200 rounded w-1/3"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Product Details */}
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-lg shadow">
            <div className="grid md:grid-cols-2 gap-8 p-8">
              {/* Product Images */}
              <div>
                <div className="relative">
                  {product.images && product.images.length > 0 ? (
                    <>
                      <img
                        src={product.images[selectedImage]}
                        alt={product.name}
                        className="w-full h-96 object-cover rounded-lg"
                      />
                      {product.lowStock && (
                        <span className="absolute top-4 left-4 bg-orange-500 text-white text-sm px-3 py-1 rounded">
                          Low Stock - Only {product.stockQuantity} left
                        </span>
                      )}
                      {!product.inStock && (
                        <span className="absolute top-4 left-4 bg-red-500 text-white text-sm px-3 py-1 rounded">
                          Out of Stock
                        </span>
                      )}
                      {product.isBestDeal && (
                        <span className="absolute top-4 left-4 bg-[#23185c] text-white text-sm px-3 py-1 rounded z-10">
                          Best Deal
                        </span>
                      )}
                      {product.originalPrice && product.originalPrice > product.price && (
                        <span className={`absolute ${product.isBestDeal ? 'top-4 right-4' : 'top-4 right-4'} bg-green-500 text-white text-sm px-3 py-1 rounded z-10`}>
                          {getDiscountPercentage(product.price, product.originalPrice)}% OFF
                        </span>
                      )}
                    </>
                  ) : (
                    <div className="w-full h-96 bg-gray-200 rounded-lg flex items-center justify-center">
                      <Package className="h-16 w-16 text-gray-400" />
                    </div>
                  )}
                </div>

                {/* Image Thumbnails */}
                {product.images && product.images.length > 1 && (
                  <div className="flex space-x-2 mt-4">
                    {product.images.map((image, index) => (
                      <button
                        key={index}
                        onClick={() => setSelectedImage(index)}
                        className={`w-20 h-20 rounded-lg overflow-hidden border-2 ${
                          selectedImage === index ? "border-blue-600" : "border-gray-300"
                        }`}
                      >
                        <img
                          src={image}
                          alt={`${product.name} ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Product Info */}
              <div>
                {/* Breadcrumb */}
                <div className="text-sm text-gray-500 mb-4">
                  <Link href="/shop" className="hover:text-blue-600">Shop</Link>
                  <span className="mx-2">/</span>
                  <Link 
                    href={`/shop?category=${product.category.id}`}
                    className="hover:text-blue-600"
                  >
                    {product.category.name}
                  </Link>
                  <span className="mx-2">/</span>
                  <div>
                    <span className="text-gray-900">{product.name}</span>
                    {product.brand && (
                      <p className="text-sm text-gray-500 mt-1">Brand: {product.brand}</p>
                    )}
                  </div>
                </div>

                <h1 className="text-3xl font-bold text-gray-900 mb-4">{product.name}</h1>

                {/* Rating placeholder */}
                <div className="flex items-center mb-4">
                  <div className="flex items-center">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`h-5 w-5 ${
                          star <= 4 ? "text-yellow-400 fill-current" : "text-gray-300"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="ml-2 text-gray-600">(4.0 out of 5)</span>
                </div>

                {/* Price */}
                <div className="mb-6">
                  <div className="flex flex-col">
                    <span className="text-3xl font-bold text-gray-900">
                      {formatPrice(product.price, product.currency)}
                    </span>
                    {product.originalPrice && product.originalPrice > product.price && (
                      <span className="text-sm text-gray-400 line-through mt-0.5">
                        {formatPrice(product.originalPrice, product.currency)}
                      </span>
                    )}
                  </div>
                  {product.sku && (
                    <p className="text-sm text-gray-500 mt-1">SKU: {product.sku}</p>
                  )}
                  {product.isBestDeal && (
                    <span className="inline-block mt-2 bg-[#23185c] text-white text-xs px-3 py-1 rounded">
                      🎯 Best Deal Product
                    </span>
                  )}
                </div>

                {/* Description */}
                <div className="mb-6">
                  <h3 className="font-semibold mb-2">Description</h3>
                  <p className="text-gray-600">
                    {product.description || "No description available for this product."}
                  </p>
                </div>

                {/* Product Attributes */}
                {product.attributes && Object.keys(product.attributes).length > 0 && (
                  <div className="mb-6">
                    <h3 className="font-semibold mb-2">Product Details</h3>
                    <dl className="grid grid-cols-2 gap-2 text-sm">
                      {Object.entries(product.attributes).map(([key, value]) => (
                        <div key={key}>
                          <dt className="text-gray-500">{key}:</dt>
                          <dd className="text-gray-900 font-medium">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}

                {/* Quantity Selector */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quantity
                  </label>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="px-3 py-1 border rounded-lg hover:bg-gray-50"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="1"
                      max={product.stockQuantity}
                      value={quantity}
                      onChange={(e) => setQuantity(Math.min(product.stockQuantity, Math.max(1, parseInt(e.target.value) || 1)))}
                      className="w-20 text-center px-3 py-1 border rounded-lg"
                    />
                    <button
                      onClick={() => setQuantity(Math.min(product.stockQuantity, quantity + 1))}
                      disabled={quantity >= product.stockQuantity}
                      className="px-3 py-1 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      +
                    </button>
                    <span className="text-sm text-gray-500">
                      ({product.stockQuantity} available)
                    </span>
                  </div>
                </div>

                {/* Add to Cart Button */}
                <button
                  onClick={addToCart}
                  disabled={!product.inStock || addingToCart}
                  className={`w-full py-3 px-6 rounded-lg font-medium transition flex items-center justify-center space-x-2 ${
                    product.inStock
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  <ShoppingCart className="h-5 w-5" />
                  <span>
                    {addingToCart
                      ? "Adding..."
                      : product.inStock
                      ? "Add to Cart"
                      : "Out of Stock"}
                  </span>
                </button>

                {/* Features */}
                <div className="mt-8 space-y-3">
                  <div className="flex items-center text-gray-600">
                    <Truck className="h-5 w-5 mr-3 text-blue-600" />
                    <span>Free delivery on orders over ₵500</span>
                  </div>
                  <div className="flex items-center text-gray-600">
                    <Shield className="h-5 w-5 mr-3 text-blue-600" />
                    <span>Secure checkout</span>
                  </div>
                  <div className="flex items-center text-gray-600">
                    <Package className="h-5 w-5 mr-3 text-blue-600" />
                    <span>Authentic products guaranteed</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Customer Reviews */}
      <div className="container mx-auto px-4 pb-12">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-3xl shadow p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Customer Reviews</h2>
                <p className="text-gray-500 text-sm">
                  Hear from pool owners and facilities that trust The PoolShop.
                </p>
              </div>
              <div className="flex items-center gap-1 text-amber-500">
                <Star className="h-5 w-5 fill-current" />
                <span className="text-sm font-semibold text-gray-700">
                  {reviews.length > 0
                    ? `${(
                        reviews.reduce((sum, review) => sum + review.rating, 0) /
                        reviews.length
                      ).toFixed(1)} / 5`
                    : "No reviews yet"}
                </span>
              </div>
            </div>

            {reviews.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-gray-600">
                No testimonials yet. Be the first to share your experience with this product!
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                {reviews.map((review) => {
                  const color = review.avatarColor || "#2563eb";
                  const isHex = typeof color === "string" && color.startsWith("#");
                  const avatarStyle = isHex ? { backgroundColor: color } : undefined;
                  const avatarClass = !isHex && color ? color : "";
                  const initials =
                    review.name
                      .split(" ")
                      .map((part) => part[0])
                      .join("")
                      .slice(0, 2) || "A";

                  return (
                    <div
                      key={review.id}
                      className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        {review.avatarImage ? (
                          <div className="h-10 w-10 overflow-hidden rounded-full border border-gray-200 bg-gray-100">
                            <img
                              src={review.avatarImage}
                              alt={`${review.name} avatar`}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ) : (
                          <div
                            className={`flex h-10 w-10 items-center justify-center rounded-full text-xs font-semibold uppercase text-white ${
                              avatarClass || "bg-blue-600"
                            }`}
                            style={avatarStyle}
                          >
                            {initials}
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{review.name}</p>
                          {review.role ? (
                            <p className="text-xs text-gray-500">{review.role}</p>
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={`${review.id}-star-${star}`}
                            className={`h-4 w-4 ${
                              star <= review.rating ? "text-amber-400 fill-current" : "text-gray-300"
                            }`}
                          />
                        ))}
                      </div>
                      <p className="mt-3 text-sm text-gray-600 leading-relaxed">{review.quote}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recommended Products */}
      <div className="container mx-auto px-4 pb-16">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Recommended For You</h2>
              <p className="text-gray-500 text-sm">
                Other popular picks that pair well with {product.name}
              </p>
            </div>
            <Link href="/shop" className="text-sm font-semibold text-[#23185c] hover:underline">
              Browse all
            </Link>
          </div>

          {recommendedProducts.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-gray-200 bg-white p-10 text-center text-gray-500">
              We&apos;re curating recommendations for this product. Please check back soon!
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {recommendedProducts.map((item) => (
                <Link
                  key={item.id}
                  href={`/shop/products/${item.id}`}
                  className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl hover:border-transparent hover:ring-2 hover:ring-[#23185c] hover:ring-offset-2 hover:ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#23185c] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                >
                  <div className="relative">
                    {item.images && item.images.length > 0 ? (
                      <img
                        src={item.images[0]}
                        alt={item.name}
                        className="h-44 w-full object-cover transition duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-44 w-full items-center justify-center bg-gray-100 text-gray-400">
                        <Package className="h-10 w-10" />
                      </div>
                    )}
                    {item.originalPrice && item.originalPrice > item.price && (
                      <span className="absolute left-4 top-4 rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                        Save {getDiscountPercentage(item.price, item.originalPrice)}%
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col px-4 py-4">
                    <h3 className="text-sm font-semibold text-gray-900 transition group-hover:text-[#23185c] line-clamp-2">
                      {item.name}
                    </h3>
                    <p className="mt-3 text-base font-bold text-gray-900">
                      {formatPrice(item.price, item.currency)}
                    </p>
                    {item.originalPrice && item.originalPrice > item.price && (
                      <p className="text-xs text-gray-500 line-through">
                        {formatPrice(item.originalPrice, item.currency)}
                      </p>
                    )}
                    <div className="mt-auto pt-4">
                      <span className="inline-flex items-center text-xs font-semibold uppercase tracking-wide text-[#23185c]/70">
                        View details
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {productPromoBanner?.isActive !== false ? (
        <section className="py-12">
          <EcommercePromoBanner {...(productPromoBanner as any)} />
        </section>
      ) : null}
    </div>
  );
}
