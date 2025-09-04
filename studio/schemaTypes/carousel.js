import {defineType} from 'sanity'

export default defineType({
  name: 'carousel',
  title: 'Image carousel',
  type: 'object',
  fields: [
    {
      name: 'images',
      title: 'Images',
      type: 'array',
      of: [
        {
          type: 'image',
          options: { hotspot: true },
          fields: [
            { name: 'alt', title: 'Alt text', type: 'string' },
            { name: 'caption', title: 'Caption', type: 'blockContent' },
            { name: 'credit', title: 'Credit', type: 'string' },
          ],
        },
      ],
      validation: (Rule) => Rule.required().min(1),
    },
    {
      name: 'speed',
      title: 'Speed (px/frame)',
      type: 'number',
      initialValue: 1,
      description: 'Visual speed of the carousel in pixels per animation frame (recommended: 0.2–2).',
    },
    {
      name: 'paddingTopToken',
      title: 'Desktop top padding token',
      type: 'string',
      initialValue: 'space-md',
      options: {
        list: [
          { title: 'None', value: 'space-0' },
          { title: 'XS', value: 'space-xs' },
          { title: 'SM', value: 'space-sm' },
          { title: 'MD', value: 'space-md' },
          { title: 'LG', value: 'space-lg' },
          { title: 'XL', value: 'space-xl' },
        ],
      },
    },
    {
      name: 'paddingBottomToken',
      title: 'Desktop bottom padding token',
      type: 'string',
      initialValue: 'space-md',
      options: {
        list: [
          { title: 'None', value: 'space-0' },
          { title: 'XS', value: 'space-xs' },
          { title: 'SM', value: 'space-sm' },
          { title: 'MD', value: 'space-md' },
          { title: 'LG', value: 'space-lg' },
          { title: 'XL', value: 'space-xl' },
        ],
      },
    },
  ],
  preview: {
    select: { first: 'images.0.asset', count: 'images' },
    prepare(selection) {
      const { first, count } = selection
      return {
        title: 'Image carousel',
        subtitle: `${count || 0} images${first ? '' : ' (no assets)'}`,
      }
    },
  },
})
