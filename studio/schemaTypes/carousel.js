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
      name: 'autoplay',
      title: 'Autoplay',
      type: 'boolean',
      initialValue: false,
    },
    {
      name: 'autoplayDelay',
      title: 'Autoplay delay (ms)',
      type: 'number',
      initialValue: 4000,
      description: 'Delay between slides when autoplay is enabled.',
    },
    {
      name: 'showControls',
      title: 'Show controls',
      type: 'boolean',
      initialValue: true,
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
