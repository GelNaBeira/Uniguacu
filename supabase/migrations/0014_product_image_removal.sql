-- Editar fotos não exige permissão para excluir o produto.
begin;
alter policy product_images_delete on storage.objects
using (bucket_id = 'product-images' and private.product_image_path_valid(name)
  and (private.is_admin() or (private.has_permission('can_read_inventory') and private.has_permission('can_manage_products')))
  and not exists (select 1 from public.products p where p.image_path = storage.objects.name));
commit;