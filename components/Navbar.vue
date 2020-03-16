<template>
  <nav-bar :options="navbarOptions" />
</template>

<script>
export default {
  data() {
    return {
      navbarOptions: {
        elementId: 'main-navbar',
        isUsingVueRouter: false,
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
                subText: "The things make me lose sleep at night",
                path: './projects'
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
/* @import url("https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css"); */
/* 
.main-content-section {
  padding: 45px 0;
  background: #0275d8;
  height: 95vh;
} */

/*vue-nav-bar stuff*/
/* 
.main-navbar-section {
  background: #0275d8;
} */

/* .vnb {

    .button-red {
      background: #0275d8;

      &:hover {
        background: darken(#0275d8, 10%);
      }
    }

    &__menu-options {
      &__option {
        &__button {
          &__icon {
            svg {
              margin-top: -3px;
            }
          }
        }
      }
    }

    &__popup {
      &__bottom {
        &__menu-options {
          &__option {
            &__link {
              &__icon {
                svg {
                  margin-top: -4px;
                }
              }
            }
          }
        }
      }
    } */

    /* .custom-section-content {
      width: 100%;

      @media (min-width: 568px) {
        width: 50%;
      }

      @media (min-width: 992px) {
        width: 15%;
      }

      @media (min-width: 1200px) {
        width: 20%;
      }
    }
  } */
</style>
