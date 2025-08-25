import {defineType} from 'sanity'

export default defineType({
  name: 'imageWithCaption',
  title: 'Image with caption',
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
      name: 'display',
      title: 'Display',
      type: 'string',
      initialValue: 'inline',
      validation: (Rule) => Rule.required().error('Please choose either Inline or Full width'),
      options: {
        // Strictly two choices: inline (constrained) or fullWidth (edge-to-edge)
        list: [
          {title: 'Inline (constrained)', value: 'inline'},
          {title: 'Full width (breaks text)', value: 'fullWidth'},
        ],
        layout: 'radio',
      },
    },
    {
      name: 'fullHeight',
      title: 'Full height (no crop)',
      type: 'boolean',
      description: 'When using Full width display, check this to show the image fully (contain) instead of cropping to cover.',
      initialValue: false,
      options: { isHighlighted: false },
  hidden: ({ parent }) => parent?.display !== 'fullWidth',
    },
    {
      name: 'wideMargins',
      title: 'Wide with side margins',
      type: 'boolean',
      description: 'Inset the full-width image by 10rem on each side (useful for a wide, but not edge-to-edge, layout). Visible only for Full width display.',
      initialValue: false,
  hidden: ({ parent }) => parent?.display !== 'fullWidth',
    },
  ],
})
