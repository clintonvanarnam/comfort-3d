import {defineField, defineType} from 'sanity'

export default defineType({
  name: 'post',
  title: 'Post',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: {
        source: 'title',
        maxLength: 96,
      },
    }),
    defineField({
      name: 'author',
      title: 'Author',
      type: 'reference',
      to: {type: 'author'},
    }),
    defineField({
      name: 'mainImage',
      title: 'Main image',
  type: 'imageWithCaptionFull',
      options: {
        hotspot: true,
      },
    }),
    defineField({
      name: 'thumbnail',
      title: 'Thumbnail (for 3D sprites - smaller image)',
      type: 'image',
      description: 'Upload a high-quality image (around 800px) for use in the 3D scene sprites. Max 1MB file size.',
      validation: Rule => Rule.custom(async (image, context) => {
        if (!image || !image.asset) {
          return true // Allow empty images and existing ones
        }
        
        // For new uploads, get the asset document to check file size
        try {
          const {getClient} = context
          const client = getClient({apiVersion: '2023-01-01'})
          const asset = await client.getDocument(image.asset._ref)
          
          if (asset && asset.size) {
            const fileSizeInMB = asset.size / (1024 * 1024)
            if (fileSizeInMB > 1) {
              return `Image file size is ${fileSizeInMB.toFixed(2)}MB. Thumbnail images must be smaller than 1MB for optimal 3D performance. Please compress the image and try again.`
            }
          }
        } catch (error) {
          // If we can't get the asset info, allow it (might be during upload)
          return true
        }
        
        return true
      }),
      options: {
        hotspot: true,
        accept: 'image/*',
      },
    }),
    defineField({
      name: 'categories',
      title: 'Categories',
      type: 'array',
      of: [{type: 'reference', to: {type: 'category'}}],
    }),
    defineField({
      name: 'publishedAt',
      title: 'Published at',
      type: 'datetime',
    }),
    defineField({
      name: 'body',
      title: 'Body',
      type: 'blockContent',
    }),
  ],

  preview: {
    select: {
      title: 'title',
      author: 'author.name',
      media: 'mainImage',
    },
    prepare(selection) {
      const {author} = selection
      return {...selection, subtitle: author && `by ${author}`}
    },
  },
})
