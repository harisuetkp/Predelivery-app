import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// POST /api/admin/copy-menu
// Copies the entire menu (categories, items, options, choices) from one restaurant to another
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { sourceRestaurantId, targetRestaurantId, clearExisting } = await request.json()

    if (!sourceRestaurantId || !targetRestaurantId) {
      return NextResponse.json({ error: "sourceRestaurantId and targetRestaurantId are required" }, { status: 400 })
    }

    if (sourceRestaurantId === targetRestaurantId) {
      return NextResponse.json({ error: "Source and target restaurants must be different" }, { status: 400 })
    }

    // Verify both restaurants exist
    const { data: restaurants } = await supabase
      .from("restaurants")
      .select("id, name")
      .in("id", [sourceRestaurantId, targetRestaurantId])

    if (!restaurants || restaurants.length !== 2) {
      return NextResponse.json({ error: "One or both restaurants not found" }, { status: 404 })
    }

    const results = {
      categories: 0,
      items: 0,
      options: 0,
      choices: 0,
      errors: [] as string[],
    }

    // If clearExisting is true, delete existing menu data from target
    if (clearExisting) {
      // First get all menu item IDs for the target restaurant
      const { data: targetItems } = await supabase
        .from("menu_items")
        .select("id")
        .eq("restaurant_id", targetRestaurantId)
      
      const targetItemIds = (targetItems || []).map(item => item.id)
      
      if (targetItemIds.length > 0) {
        // Get all option IDs for those menu items
        const { data: targetOptions } = await supabase
          .from("item_options")
          .select("id")
          .in("menu_item_id", targetItemIds)
        
        const targetOptionIds = (targetOptions || []).map(opt => opt.id)
        
        // Delete in correct order due to foreign keys
        if (targetOptionIds.length > 0) {
          await supabase.from("item_option_choices").delete().in("item_option_id", targetOptionIds)
        }
        await supabase.from("item_options").delete().in("menu_item_id", targetItemIds)
      }
      
      await supabase.from("menu_items").delete().eq("restaurant_id", targetRestaurantId)
      await supabase.from("categories").delete().eq("restaurant_id", targetRestaurantId)
    }

    // 1. Fetch all source categories
    const { data: sourceCategories, error: catErr } = await supabase
      .from("categories")
      .select("*")
      .eq("restaurant_id", sourceRestaurantId)
      .order("display_order")

    if (catErr) {
      return NextResponse.json({ error: `Failed to fetch categories: ${catErr.message}` }, { status: 500 })
    }

    // 2. Copy categories and build ID mapping
    const categoryIdMap = new Map<string, string>() // old id -> new id

    for (const cat of sourceCategories || []) {
      const { data: newCat, error: insertErr } = await supabase
        .from("categories")
        .insert({
          restaurant_id: targetRestaurantId,
          name: cat.name,
          description: cat.description,
          display_order: cat.display_order,
          is_active: cat.is_active,
          header_image_url: cat.header_image_url,
          available_days: cat.available_days,
        })
        .select("id")
        .single()

      if (insertErr) {
        results.errors.push(`Category ${cat.name}: ${insertErr.message}`)
        continue
      }

      categoryIdMap.set(cat.id, newCat.id)
      results.categories++
    }

    // 3. Fetch all source menu items
    const { data: sourceItems, error: itemErr } = await supabase
      .from("menu_items")
      .select("*")
      .eq("restaurant_id", sourceRestaurantId)
      .order("display_order")

    if (itemErr) {
      results.errors.push(`Failed to fetch items: ${itemErr.message}`)
    }

    // 4. Copy items and build ID mapping
    const itemIdMap = new Map<string, string>() // old id -> new id

    for (const item of sourceItems || []) {
      const newCategoryId = categoryIdMap.get(item.category_id)
      if (!newCategoryId) {
        results.errors.push(`Item ${item.name}: category not found`)
        continue
      }

      const { data: newItem, error: insertErr } = await supabase
        .from("menu_items")
        .insert({
          restaurant_id: targetRestaurantId,
          category_id: newCategoryId,
          item_type_id: item.item_type_id,
          name: item.name,
          description: item.description,
          price: item.price,
          image_url: item.image_url,
          serves: item.serves,
          dietary_tags: item.dietary_tags,
          is_bundle: item.is_bundle,
          display_order: item.display_order,
          is_active: item.is_active,
          selling_unit: item.selling_unit,
          unit_label: item.unit_label,
          per_unit_price: item.per_unit_price,
          delivery_lead_time: item.delivery_lead_time,
          pickup_lead_time: item.pickup_lead_time,
          is_bulk_item: item.is_bulk_item,
          bulk_min_quantity: item.bulk_min_quantity,
          is_upsell_item: item.is_upsell_item,
          available_days: item.available_days,
          availability_daypart: item.availability_daypart,
          is_cart_upsell: item.is_cart_upsell,
          external_id: item.external_id ? `copy-${item.external_id}` : null,
        })
        .select("id")
        .single()

      if (insertErr) {
        results.errors.push(`Item ${item.name}: ${insertErr.message}`)
        continue
      }

      itemIdMap.set(item.id, newItem.id)
      results.items++
    }

    // 5. Fetch all source options
    const optionIdMap = new Map<string, string>() // old id -> new id
    const itemKeys = Array.from(itemIdMap.keys())
    
    if (itemKeys.length > 0) {
      const { data: sourceOptions, error: optErr } = await supabase
        .from("item_options")
        .select("*")
        .in("menu_item_id", itemKeys)
        .order("display_order")

      if (optErr) {
        results.errors.push(`Failed to fetch options: ${optErr.message}`)
      }

      // 6. Copy options and build ID mapping
      for (const opt of sourceOptions || []) {
        const newItemId = itemIdMap.get(opt.menu_item_id)
        if (!newItemId) continue

        const { data: newOpt, error: insertErr } = await supabase
          .from("item_options")
          .insert({
            menu_item_id: newItemId,
            category: opt.category,
            prompt: opt.prompt,
            is_required: opt.is_required,
            min_selection: opt.min_selection,
            max_selection: opt.max_selection,
            display_order: opt.display_order,
            display_type: opt.display_type,
            external_id: opt.external_id ? `copy-${opt.external_id}` : null,
          })
          .select("id")
          .single()

        if (insertErr) {
          results.errors.push(`Option ${opt.category}: ${insertErr.message}`)
          continue
        }

        optionIdMap.set(opt.id, newOpt.id)
        results.options++
      }
    }

    // 7. Fetch all source choices
    const optionKeys = Array.from(optionIdMap.keys())
    
    if (optionKeys.length > 0) {
      const { data: sourceChoices, error: choiceErr } = await supabase
        .from("item_option_choices")
        .select("*")
        .in("item_option_id", optionKeys)
        .order("display_order")

      if (choiceErr) {
        results.errors.push(`Failed to fetch choices: ${choiceErr.message}`)
      }

      // 8. Copy choices
      for (const choice of sourceChoices || []) {
        const newOptionId = optionIdMap.get(choice.item_option_id)
        if (!newOptionId) continue

        const { error: insertErr } = await supabase
          .from("item_option_choices")
          .insert({
            item_option_id: newOptionId,
            name: choice.name,
            description: choice.description,
            price_modifier: choice.price_modifier,
            display_order: choice.display_order,
            external_id: choice.external_id ? `copy-${choice.external_id}` : null,
          })

        if (insertErr) {
          results.errors.push(`Choice ${choice.name}: ${insertErr.message}`)
          continue
        }

        results.choices++
      }
    }

    return NextResponse.json({
      success: true,
      message: `Menu copied successfully`,
      results,
    })
  } catch (error: any) {
    console.error("Copy menu error:", error)
    return NextResponse.json({ error: error.message || "Failed to copy menu" }, { status: 500 })
  }
}
