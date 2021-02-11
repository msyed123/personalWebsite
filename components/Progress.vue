<template>
<div>
    <div v-if="loading">
        <b-card
        no-body
        style="width: 85%"
        border-variant="primary"
        header-bg-variant="primary"
        header-text-variant="white" 
        class="mx-auto"
        header="Loading...">
            <Loading />
        </b-card>
    </div>
    <div v-else>
        <b-card
        class="mx-auto"
        style="width: 85%"
        border-variant="primary"
        header="Skills"
        header-bg-variant="primary"
        header-text-variant="white"
        >
            <ul>
                <li v-for="topic in topics" v-bind:key="topic.title">
                    <b-card
                    class="mx-auto"
                    border-variant="primary"
                    v-bind:header = "topic.data.title[0].text"
                    header-text-variant="primary"
                    >
                        <li v-for="tool in topic.data.tools" v-bind:key="tool.name">
                            <div class="task">{{tool.name[0].text}}</div>
                            <div class="bar">
                                <div class="progress" v-bind:style = "{'background':topic.data.color, 'width':tool.confidence+'%'}"></div>
                                <span class="percent">{{tool.confidence}}%</span>
                            </div>
                        </li>
                    </b-card>
                </li>
            </ul>
        </b-card>
    </div>
</div>    
</template>

<script>
import Loading from "~/components/Loading.vue";
import Prismic from "prismic-javascript";
// import PrismicDom from "prismic-dom";

export default {
    components: {
        Loading
    },
    data() {
        return{
            loading: true,
            topics: []
        };
    },

    methods: {
        async getSkills() {
            const api = await Prismic.getApi(process.env.PRISMIC_ENDPOINT, {accessToken: process.env.PRISMIC_TOKEN});

            const response = await api.query(
                Prismic.Predicates.at("document.type", "topic"),
                { orderings : '[document.priority desc]'}
            )
            this.topics = response.results;
            this.loading = false;
        }
    },

    created () {
        this.getSkills()
    }
};
</script>

<style>
body{
	font-family: monaco, monospace;
}

*{
	padding: 0;
	margin: 0;
	box-sizing:border-box;
}

ul li{
	list-style-type: none;
	padding:10px;
}

.task{
	margin:5px;
	font-size: 16px;
}

.bar{
	width: 100%;
	background:#dfdfdf;
	overflow: hidden;
	padding:5px;
}

.progress{
	float:left;
	padding:15px;
}

.percent{
	float: right;
	font-weight: 600;
	height: 30px;
	line-height: 30px;
}
</style>
