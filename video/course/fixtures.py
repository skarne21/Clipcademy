"""Shared test data for the course pipeline: a valid course clip and a matching breakdown."""
import copy

MATERIAL_TEXT = (
    'Lecture 3: Supply and demand.\n'
    'When demand for a good rises and supply stays the same, the price rises.\n'
    'Sellers raise prices until the quantity demanded matches the quantity supplied.\n'
    'When supply rises and demand stays the same, the price falls.\n'
)

CLIP = {
    'course_id': 'econ101',
    'topic_id': 'supply_and_demand',
    'objective_id': 'price_changes',
    'variant_id': 'intro_1',
    'kind': 'intro',
    'format': 'vertical',
    'teaching_goal': 'When demand beats supply, prices go up.',
    'source_refs': ['econ101-lecture3-p1'],
    'review_status': 'pending',
    'review_notes': {
        'hook_claim': 'Prices rise when demand rises and supply stays the same: econ101-lecture3-p1.',
        'analogy': 'An auction; check it does not imply every market is an auction.',
        'new_term': 'none new',
    },
    'scenes': [{
        'template': 'steps',
        'title': 'Why do prices go up?',
        'props': {'steps': [
            {'id': 'buyers', 'text': 'Lots of buyers'},
            {'id': 'seats', 'text': 'Only a few seats'},
            {'id': 'price', 'text': 'Price goes up'},
        ]},
        'narration': ('Why do prices rise when everyone wants the same thing? Picture one concert with too few '
                      'tickets. First, lots of buyers show up. Second, there are only a few seats. Third, sellers '
                      'raise the price until fewer people want them. Think of it like an auction where the highest '
                      'bidder wins. When demand beats supply, prices go up. But what happens when supply grows? Swipe.'),
        'beats': [
            {'on': '^', 'do': ['pose:think']},
            {'on': 'concert', 'do': ['pose:present']},
            {'on': 'first', 'do': ['reveal:buyers', 'point:buyers']},
            {'on': 'second', 'do': ['reveal:seats', 'point:seats']},
            {'on': 'third', 'do': ['reveal:price', 'highlight:price']},
            {'on': 'auction', 'do': ['card:Like an auction', 'pose:present']},
            {'on': 'demand beats supply', 'do': ['check:price', 'pose:thumbs']},
            {'on': 'supply grows', 'do': ['pose:think']},
            {'on': 'swipe', 'do': ['pulse:price']},
        ],
    }],
}

BREAKDOWN = {
    'course_id': 'econ101',
    'title': 'Intro Economics',
    'objectives': [{
        'topic_id': 'supply_and_demand',
        'objective_id': 'price_changes',
        'label': 'How supply and demand move prices',
        'source_excerpts': [
            {'ref': 'econ101-lecture3-p1',
             'text': 'When demand for a good rises and supply stays the same, the price rises.'},
        ],
        'clips': [
            {'variant_id': 'intro_1', 'kind': 'intro', 'teaching_goal': 'When demand beats supply, prices go up.',
             'source_refs': ['econ101-lecture3-p1']},
            {'variant_id': 'intro_2', 'kind': 'last_intro', 'teaching_goal': 'When supply beats demand, prices go down.',
             'source_refs': ['econ101-lecture3-p1']},
        ],
    }],
}


def clip(**changes):
    out = copy.deepcopy(CLIP)
    out.update(changes)
    return out


def scene_clip(**changes):
    out = copy.deepcopy(CLIP)
    out['scenes'][0].update(changes)
    return out


def last_intro_clip():
    out = copy.deepcopy(CLIP)
    out.update(variant_id='intro_2', kind='last_intro', teaching_goal='When supply beats demand, prices go down.')
    sc = out['scenes'][0]
    sc['narration'] = sc['narration'].replace('But what happens when supply grows? Swipe.',
                                              "And when supply grows, prices fall. Let's see what you remember.")
    sc['beats'][-2] = {'on': 'supply grows', 'do': ['pose:think']}
    sc['beats'][-1] = {'on': 'remember', 'do': ['pulse:price']}
    return out
