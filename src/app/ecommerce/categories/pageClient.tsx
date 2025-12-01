"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "@/contexts/theme-context";
import { useToast } from "@/contexts/toast-context";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AIRecommendationCard } from "@/components/ai-recommendation-card";
import {
  AlertTriangle,
  ArrowUpRight,
  FolderTree,
  Image,
  Loader2,
  Package,
  RefreshCcw,
  Search,
  Sparkles,
  Star,
  Tags,
  Trash2,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";

type EcommerceCategoryConfig = {
  isFeatured: boolean;
  displayOrder: number;
  heroImageUrl: string | null;
  tileImageUrl: string | null;
  marketingTagline: string | null;
  merchandisingNotes: string | null;
  opsNotes: string | null;
  aiPrompt: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
  createdAt: string | null;
};

type EcommerceCategory = {
  id: string;
  name: string;
  description: string | null;
  parent: { id: string; name: string } | null;
  childCount: number;
  productCount: number;
  activeProductCount: number;
  newProductsLast30Days: number;
  ecommerce: EcommerceCategoryConfig | null;
};

type CategoriesResponse = {
  data: EcommerceCategory[];
  metrics: {
    totalCategories: number;
    featuredCategories: number;
    totalProducts: number;
    totalActiveProducts: number;
    newProductsLast30Days: number;
  };
};

type CategoryFormState = {
  isFeatured: boolean;
  displayOrder: number;
  heroImageUrl: string;
  tileImageUrl: string;
  marketingTagline: string;
  merchandisingNotes: string;
  opsNotes: string;
  aiPrompt: string;
};

const initialFormState: CategoryFormState = {
  isFeatured: false,
  displayOrder: 0,
  heroImageUrl: "",
  tileImageUrl: "",
  marketingTagline: "",
  merchandisingNotes: "",
  opsNotes: "",
  aiPrompt: "",
};

export default function EcommerceCategoriesClient() {
  const { getThemeColor } = useTheme();
  const { success: toastSuccess, error: toastError } = useToast();
  const [categories, setCategories] = useState<EcommerceCategory[]>([]);
  const [metrics, setMetrics] = useState<CategoriesResponse["metrics"]>({
    totalCategories: 0,
    featuredCategories: 0,
    totalProducts: 0,
    totalActiveProducts: 0,
    newProductsLast30Days: 0,
  });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [selectedCategory, setSelectedCategory] =
    useState<EcommerceCategory | null>(null);
  const [formState, setFormState] =
    useState<CategoryFormState>(initialFormState);
  const [saving, setSaving] = useState(false);
  const [tileImageUploading, setTileImageUploading] = useState(false);
  const tileFileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (featuredOnly) params.set("featured", "true");

      const response = await fetch(
        `/api/ecommerce/categories?${params.toString()}`,
        { credentials: "include" }
      );

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(
          errorPayload.error || "Failed to fetch ecommerce categories"
        );
      }

      const payload = (await response.json()) as CategoriesResponse;
      setCategories(payload.data ?? []);
      setMetrics(payload.metrics);
    } catch (error) {
      console.error("Error fetching ecommerce categories:", error);
      toastError(
        "Failed to fetch ecommerce categories",
        error instanceof Error ? error.message : undefined
      );
    } finally {
      setLoading(false);
    }
  }, [featuredOnly, search, toastError]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleResetFilters = () => {
    setSearch("");
    setFeaturedOnly(false);
  };

  const handleSelectCategory = (category: EcommerceCategory) => {
    setSelectedCategory(category);
    const ecommerce = category.ecommerce;
    setFormState({
      isFeatured: ecommerce?.isFeatured ?? false,
      displayOrder: ecommerce?.displayOrder ?? 0,
      heroImageUrl: ecommerce?.heroImageUrl ?? "",
      tileImageUrl: ecommerce?.tileImageUrl ?? "",
      marketingTagline: ecommerce?.marketingTagline ?? "",
      merchandisingNotes: ecommerce?.merchandisingNotes ?? "",
      opsNotes: ecommerce?.opsNotes ?? "",
      aiPrompt: ecommerce?.aiPrompt ?? "",
    });
  };

  const handleUpdateForm = <Key extends keyof CategoryFormState>(
    key: Key,
    value: CategoryFormState[Key]
  ) => {
    setFormState((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSaveConfig = async () => {
    if (!selectedCategory) return;

    setSaving(true);
    try {
      const payload = {
        categoryId: selectedCategory.id,
        isFeatured: formState.isFeatured,
        displayOrder: Number.isFinite(formState.displayOrder)
          ? Number(formState.displayOrder)
          : 0,
        heroImageUrl: formState.heroImageUrl || null,
        tileImageUrl: formState.tileImageUrl || null,
        marketingTagline: formState.marketingTagline || null,
        merchandisingNotes: formState.merchandisingNotes || null,
        opsNotes: formState.opsNotes || null,
        aiPrompt: formState.aiPrompt || null,
      };

      const response = await fetch("/api/ecommerce/categories", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(
          errorPayload.error || "Failed to update ecommerce category"
        );
      }

      toastSuccess("Ecommerce category updated");
      setSelectedCategory(null);
      fetchCategories();
    } catch (error) {
      console.error("Error updating ecommerce category:", error);
      toastError(
        "Failed to update ecommerce category",
        error instanceof Error ? error.message : undefined
      );
    } finally {
      setSaving(false);
    }
  };

  const handleTileImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setTileImageUploading(true);
    try {
      const uploadForm = new FormData();
      uploadForm.append("file", file);
      uploadForm.append("type", "category");

      const response = await fetch("/api/upload/images", {
        method: "POST",
        body: uploadForm,
        credentials: "include",
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(
          errorPayload.error || "Failed to upload category image"
        );
      }

      const result = await response.json();
      handleUpdateForm("tileImageUrl", result.url ?? "");
      toastSuccess("Category image uploaded", "Save to publish changes");
    } catch (error) {
      console.error("Error uploading category image:", error);
      toastError(
        "Failed to upload image",
        error instanceof Error ? error.message : undefined
      );
    } finally {
      setTileImageUploading(false);
      event.target.value = "";
    }
  };

  const summaryCards = useMemo(
    () => [
      {
        title: "Total categories",
        value: metrics.totalCategories,
        description: "Ecommerce-ready category records",
        icon: FolderTree,
        accent: getThemeColor("primary"),
      },
      {
        title: "Featured categories",
        value: metrics.featuredCategories,
        description: "Highlighted on storefront & campaigns",
        icon: Star,
        accent: getThemeColor("amber"),
      },
      {
        title: "Active products",
        value: metrics.totalActiveProducts,
        description: "Published products tied to categories",
        icon: Package,
        accent: getThemeColor("emerald"),
      },
      {
        title: "New items (30d)",
        value: metrics.newProductsLast30Days,
        description: "Fresh catalogue additions",
        icon: Sparkles,
        accent: getThemeColor("violet"),
      },
    ],
    [
      getThemeColor,
      metrics.featuredCategories,
      metrics.newProductsLast30Days,
      metrics.totalActiveProducts,
      metrics.totalCategories,
    ]
  );

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <Card
            key={card.title}
            className="border border-gray-100 shadow-none hover:border-gray-200 transition-colors"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                {card.title}
              </CardTitle>
              <card.icon className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div
                className="text-2xl font-semibold"
                style={{ color: card.accent }}
              >
                {card.value}
              </div>
              <p className="text-xs text-gray-500">{card.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card className="border border-gray-100 shadow-sm">
          <CardHeader className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base sm:text-lg font-semibold">
                  Ecommerce Categories
                </CardTitle>
                <p className="text-xs sm:text-sm text-gray-500">
                  Manage merchandising metadata, featured placement, and
                  operations guidance by category.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <Button
                  variant={featuredOnly ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFeaturedOnly((prev) => !prev)}
                >
                  <Star
                    className={cn("h-4 w-4", {
                      "text-yellow-500": featuredOnly,
                      "text-gray-400": !featuredOnly,
                    })}
                  />
                  <span className="ml-2 text-xs sm:text-sm">
                    <span className="hidden sm:inline">{featuredOnly ? "Showing featured" : "Show featured only"}</span>
                    <span className="sm:hidden">Featured</span>
                  </span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchCategories}
                  disabled={loading}
                >
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 w-full sm:min-w-[220px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search categories..."
                  className="pl-9 w-full"
                />
              </div>
              {(search || featuredOnly) && (
                <Button variant="ghost" size="sm" onClick={handleResetFilters} className="w-full sm:w-auto">
                  Clear filters
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto -mx-6 sm:mx-0 px-6 sm:px-0">
              <table className="min-w-[800px] sm:min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50/60">
                  <tr className="text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    <th className="px-2 sm:px-4 py-3">Category</th>
                    <th className="px-2 sm:px-4 py-3 hidden md:table-cell">Parent</th>
                    <th className="px-2 sm:px-4 py-3 text-center hidden lg:table-cell">Children</th>
                    <th className="px-2 sm:px-4 py-3 text-center">Products</th>
                    <th className="px-2 sm:px-4 py-3 text-center hidden md:table-cell">Active</th>
                    <th className="px-2 sm:px-4 py-3 text-center hidden lg:table-cell">New (30d)</th>
                    <th className="px-2 sm:px-4 py-3 text-center">Featured</th>
                    <th className="px-2 sm:px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {loading ? (
                    <tr>
                      <td colSpan={8}>
                        <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-500">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading categories...
                        </div>
                      </td>
                    </tr>
                  ) : categories.length === 0 ? (
                    <tr>
                      <td colSpan={8}>
                        <div className="flex flex-col items-center justify-center gap-3 py-12 text-sm text-gray-500">
                          <Tags className="h-8 w-8 text-gray-300" />
                          <p>No categories match the current filters.</p>
                          <Button size="sm" onClick={handleResetFilters}>
                            Reset filters
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    categories.map((category) => (
                      <tr key={category.id} className="hover:bg-gray-50/40">
                        <td className="px-2 sm:px-4 py-3">
                          <div className="flex flex-col gap-1 min-w-0">
                            <span className="font-medium text-gray-900 break-words">
                              {category.name}
                            </span>
                            {category.description ? (
                              <span className="text-xs text-gray-500 break-words">
                                {category.description}
                              </span>
                            ) : null}
                            <div className="md:hidden text-xs text-gray-500 mt-1">
                              {category.parent && <span>Parent: {category.parent.name}</span>}
                              {category.childCount > 0 && <span className="ml-2">Children: {category.childCount}</span>}
                            </div>
                          </div>
                        </td>
                        <td className="px-2 sm:px-4 py-3 text-sm text-gray-600 hidden md:table-cell">
                          {category.parent ? category.parent.name : "—"}
                        </td>
                        <td className="px-2 sm:px-4 py-3 text-center text-sm text-gray-600 hidden lg:table-cell">
                          {category.childCount}
                        </td>
                        <td className="px-2 sm:px-4 py-3 text-center text-sm text-gray-600">
                          {category.productCount}
                        </td>
                        <td className="px-2 sm:px-4 py-3 text-center text-sm text-gray-600 hidden md:table-cell">
                          {category.activeProductCount}
                        </td>
                        <td className="px-2 sm:px-4 py-3 text-center text-sm text-gray-600 hidden lg:table-cell">
                          {category.newProductsLast30Days}
                        </td>
                        <td className="px-2 sm:px-4 py-3 text-center">
                          {category.ecommerce?.isFeatured ? (
                            <Badge className="bg-amber-100 text-amber-700 text-xs">
                              Featured
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">Standard</Badge>
                          )}
                        </td>
                        <td className="px-2 sm:px-4 py-3">
                          <div className="flex justify-end gap-1 sm:gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                handleSelectCategory(category)
                              }
                              className="text-xs sm:text-sm"
                            >
                              <span className="hidden sm:inline">Configure</span>
                              <span className="sm:hidden">Config</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                handleSelectCategory(category)
                              }
                              className="p-1 sm:p-2"
                            >
                              <ArrowUpRight className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <AIRecommendationCard pageKey="ecommerce-categories" />

          <Card className="border border-gray-100 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                How categories drive ecommerce
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-gray-600">
              <p className="flex items-start gap-2">
                <Star className="mt-0.5 h-4 w-4 text-amber-500" />
                Featured categories drive storefront tiles, homepage modules,
                and campaign automation.
              </p>
              <p className="flex items-start gap-2">
                <Package className="mt-0.5 h-4 w-4 text-emerald-500" />
                Active product counts help supply chain and merchandising spot
                thin or overloaded ranges quickly.
              </p>
              <p className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-rose-500" />
                Ops notes surface in order prep so riders know when to bring
                extra hands or special vehicles.
              </p>
              <p className="flex items-start gap-2">
                <Sparkles className="mt-0.5 h-4 w-4 text-violet-500" />
                AI prompts enrich recommendations with the right upsell angle
                for each category.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog
        open={!!selectedCategory}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedCategory(null);
          }
        }}
      >
        {selectedCategory && (
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedCategory.name}
                {formState.isFeatured ? (
                  <Badge className="ml-3 bg-amber-100 text-amber-700">
                    Featured
                  </Badge>
                ) : null}
              </DialogTitle>
              <DialogDescription>
                Align marketing placement, AI messaging, and operations guidance
                for this category.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              <section className="grid gap-4 grid-cols-1 md:grid-cols-2">
                <Card className="border border-gray-100 shadow-none">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-gray-600">
                      Catalogue Snapshot
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-gray-700">
                    <p className="flex items-center justify-between">
                      <span>Parent</span>
                      <span className="font-medium">
                        {selectedCategory.parent?.name ?? "None"}
                      </span>
                    </p>
                    <p className="flex items-center justify-between">
                      <span>Child categories</span>
                      <span className="font-medium">
                        {selectedCategory.childCount}
                      </span>
                    </p>
                    <p className="flex items-center justify-between">
                      <span>Total products</span>
                      <span className="font-medium">
                        {selectedCategory.productCount}
                      </span>
                    </p>
                    <p className="flex items-center justify-between">
                      <span>Active products</span>
                      <span className="font-medium text-emerald-600">
                        {selectedCategory.activeProductCount}
                      </span>
                    </p>
                    <p className="flex items-center justify-between">
                      <span>New (30 days)</span>
                      <span className="font-medium text-violet-600">
                        {selectedCategory.newProductsLast30Days}
                      </span>
                    </p>
                  </CardContent>
                </Card>

                <Card className="border border-gray-100 shadow-none">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-gray-600">
                      Featured Placement
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm text-gray-700">
                    <div className="flex items-center justify-between">
                      <Label
                        htmlFor="isFeatured"
                        className="text-sm font-medium text-gray-700"
                      >
                        Promote as featured
                      </Label>
                      <Button
                        id="isFeatured"
                        variant={formState.isFeatured ? "default" : "outline"}
                        size="sm"
                        onClick={() =>
                          handleUpdateForm("isFeatured", !formState.isFeatured)
                        }
                      >
                        {formState.isFeatured ? "Featured" : "Standard"}
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="displayOrder" className="text-sm">
                        Display priority
                      </Label>
                      <Input
                        id="displayOrder"
                        type="number"
                        min={0}
                        value={String(formState.displayOrder ?? 0)}
                        onChange={(event) =>
                          handleUpdateForm(
                            "displayOrder",
                            Number.parseInt(event.target.value || "0", 10)
                          )
                        }
                      />
                      <p className="text-xs text-gray-500">
                        Lower numbers appear first across featured blocks.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Shop tile image</Label>
                      {formState.tileImageUrl ? (
                        <div className="relative overflow-hidden rounded-2xl border border-gray-200">
                          <img
                            src={formState.tileImageUrl}
                            alt={`${selectedCategory.name} tile`}
                            className="h-40 w-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => handleUpdateForm("tileImageUrl", "")}
                            className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-gray-600 shadow hover:bg-white"
                            aria-label="Remove category image"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex h-40 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 text-center text-xs text-gray-500">
                          <Image className="mb-2 h-6 w-6 text-gray-300" />
                          Upload a landscape image for the storefront tile.
                        </div>
                      )}
                      <input
                        ref={tileFileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleTileImageUpload}
                        disabled={tileImageUploading}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        disabled={tileImageUploading}
                        onClick={() => tileFileInputRef.current?.click()}
                      >
                        {tileImageUploading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="mr-2 h-4 w-4" />
                            {formState.tileImageUrl ? "Replace image" : "Upload image"}
                          </>
                        )}
                      </Button>
                      <p className="text-xs text-gray-500">
                        Rendered on the storefront “Shop by Category” tiles.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="heroImageUrl" className="text-sm">
                        Hero image URL
                      </Label>
                      <Input
                        id="heroImageUrl"
                        placeholder="https://..."
                        value={formState.heroImageUrl}
                        onChange={(event) =>
                          handleUpdateForm("heroImageUrl", event.target.value)
                        }
                      />
                      <p className="text-xs text-gray-500 flex items-center gap-2">
                        <Image className="h-3.5 w-3.5 text-gray-400" />
                        Appears on promos and AI-generated banners.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="marketingTagline" className="text-sm">
                        Marketing tagline
                      </Label>
                      <Input
                        id="marketingTagline"
                        placeholder="e.g. Fast-acting algae control in 24 hours"
                        value={formState.marketingTagline}
                        onChange={(event) =>
                          handleUpdateForm(
                            "marketingTagline",
                            event.target.value
                          )
                        }
                      />
                      <p className="text-xs text-gray-500">
                        Short punchline for storefront tiles and campaigns.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </section>

              <section className="grid gap-4 grid-cols-1 md:grid-cols-2">
                <div className="space-y-3">
                  <Label htmlFor="merchandisingNotes" className="text-sm">
                    Merchandising notes
                  </Label>
                  <Textarea
                    id="merchandisingNotes"
                    rows={4}
                    placeholder="Key value props, bundles, pricing cues for merchandising & marketing teams."
                    value={formState.merchandisingNotes}
                    onChange={(event) =>
                      handleUpdateForm("merchandisingNotes", event.target.value)
                    }
                  />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="opsNotes" className="text-sm">
                    Operations notes
                  </Label>
                  <Textarea
                    id="opsNotes"
                    rows={4}
                    placeholder="Handling instructions for warehouse and delivery teams."
                    value={formState.opsNotes}
                    onChange={(event) =>
                      handleUpdateForm("opsNotes", event.target.value)
                    }
                  />
                </div>
              </section>

              <section className="space-y-3">
                <Label htmlFor="aiPrompt" className="text-sm">
                  AI prompt guidance
                </Label>
                <Textarea
                  id="aiPrompt"
                  rows={4}
                  placeholder="Provide selling angles, cross-sell ideas, or compliance notes that the AI should remember when recommending items in this category."
                  value={formState.aiPrompt}
                  onChange={(event) =>
                    handleUpdateForm("aiPrompt", event.target.value)
                  }
                />
              </section>
            </div>

            <DialogFooter className="mt-6 flex flex-col sm:flex-row justify-between gap-3 sm:gap-4">
              <Button
                variant="outline"
                onClick={() => setSelectedCategory(null)}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button onClick={handleSaveConfig} disabled={saving} className="w-full sm:w-auto">
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save changes
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

