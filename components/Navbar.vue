<template>
  <vue-navigation-bar :options="navbarOptions" />
</template>

<script>
import "vue-navigation-bar/dist/vue-navigation-bar.css";
export default {
  data() {
    return {
      navbarOptions: {
        elementId: 'main-navbar',
        isUsingVueRouter: true,
        mobileBreakpoint: 992,
        brandImagePath: './',
        brandImageAltText: 'brand-image',
        collapseButtonImageOpen: require('../static/collapse-menu-dark.png'),
        collapseButtonImageClose: require('../static/chevron-down.png'),
        showBrandImageInMobilePopup: true,
        ariaLabelMainNav: 'Main Navigation',
        tooltipAnimationType: 'shift-away',
        menuOptionsLeft: [
          {
            type: 'button',
            text: 'Home',
            path: './'
          },
          {
            type: 'link',
            text: 'About',
            path: './about',
            subMenuOptions: [
              {
                type: 'link',
                subText: "Stuff I find interesting and think I'm OK-ish at",
                path: './about'
              },
            ]
          },
          {
            type: 'link',
            text: 'Projects',
            subMenuOptions: [
              {
                type: 'link',
                subText: "My bringers of insomnia",
                path: './projects'
              },
            ]
          },
          {
            type: 'link',
            text: 'Courses',
            subMenuOptions: [
              {
                type: 'link',
                subText: "The stuff that gives my diploma meaning",
                path: './courses'
              },
            ]
          },
          {
            type: 'link',
            text: 'Contact',
            subMenuOptions: [
              {
                type: 'link',
                subText: "I promise I am not currently known to bite",
                path: './contact'
              },
            ]
          },
        ],
      }
    }
  },
};
</script>

<style>
</style>
