import {defineType} from 'sanity'

export default defineType({
  name: 'imageWithCaptionFull',
  title: 'Image with caption (full width)',
  type: 'image',
  fields: [
    {
      name: 'alt',
      title: 'Alt text',
      type: 'string',
      options: {isHighlighted: true},
    },
    {
      name: 'caption',
      title: 'Caption',
      // Use the shared blockContent schema so captions can be rich text
      type: 'blockContent',
      options: {isHighlighted: true},
    },
    {
      name: 'fullHeight',
      title: 'Full height (no crop)',
      type: 'boolean',
      description: 'Show the image fully (contain) instead of cropping to cover.',
      initialValue: false,
      options: { isHighlighted: false },
    },
    {
      name: 'wideMargins',
      title: 'Wide with side margins',
      type: 'boolean',
      description: 'Inset the full-width image by 10rem on each side (useful for a wide, but not edge-to-edge, layout).',
      initialValue: false,
    },
  ],
})
